#!/usr/bin/env python3
"""Real local-service acceptance. Creates and removes only its own synthetic fixtures.

Run from repository root with backend/.venv/bin/python scripts/enterprise_acceptance.py.
Requires running Compose services, installed frontend dependencies and system Chrome.
Real redacted query events and disabled audit integrations remain as test evidence.
No Gemini key is read or configured by this script. It checks the configured mode;
when generation is active this makes a real provider call using synthetic evidence.
"""

import os
import secrets
import subprocess
import sys
import time
from pathlib import Path

root = Path.cwd()
sys.path.insert(0, str(root / "backend"))
import httpx
from app.auth import hasher
from app.database import engine
from app.models import Admin, AdminSession, SecurityAudit
from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

run = secrets.token_hex(6)
username = "acceptance-" + run
password = secrets.token_urlsafe(32)
operator_id = None
document_id = None
integration_id = None
key_id = None
portal = None
client = httpx.Client(
    base_url="http://localhost:8000",
    headers={"Origin": "http://localhost:8080"},
    timeout=180,
)
try:
    with Session(engine()) as db:
        operator = Admin(username=username, password_hash=hasher.hash(password))
        db.add(operator)
        db.commit()
        operator_id = operator.id
    response = client.post(
        "/api/auth/login", json={"username": username, "password": password}
    )
    assert response.status_code == 200, "Temporary operator login failed"
    client.headers["X-CSRF-Token"] = response.json()["csrf_token"]
    config = client.get("/api/config").json()
    expected_mode = "retrieval_only" if config["llm_provider"] == "none" else "grounded"
    title = "Synthetic Atlas acceptance policy " + run
    content = f"# {title}\n\nSYNTHETIC portfolio verification. The Atlas demonstration remote work policy allows up to three remote-work days per week with manager approval. Shared collaboration hours are 10:00 to 16:00 Paris time. Remote work requires a managed device and VPN for private resources. This is not an actual company policy."
    response = client.post(
        "/api/documents",
        files={
            "file": (
                "atlas-acceptance-" + run + ".md",
                content.encode(),
                "text/markdown",
            )
        },
        data={"category": "Synthetic verification"},
    )
    assert response.status_code == 201 and response.json()["status"] == "indexed", (
        "Actual ingestion failed"
    )
    document_id = response.json()["id"]
    assert (
        client.patch(
            f"/api/documents/{document_id}/access", json={"employee_available": True}
        ).status_code
        == 200
    )
    response = client.post(
        "/api/admin/integrations",
        json={
            "name": "Synthetic acceptance " + run,
            "allowed_origins": ["http://127.0.0.1:18763"],
            "document_ids": [document_id],
        },
    )
    assert response.status_code == 201, "Integration creation failed"
    integration_id = response.json()["id"]
    response = client.post(f"/api/admin/integrations/{integration_id}/keys", json={})
    assert response.status_code == 201
    key = response.json()["secret"]
    key_id = response.json()["id"]
    env = {
        **os.environ,
        "KNOWLEDGEOS_INTEGRATION_KEY": key,
        "KNOWLEDGEOS_API_URL": "http://localhost:8000/api/v1",
        "KNOWLEDGEOS_PUBLIC_API_URL": "http://localhost:8000/api/v1",
        "PORTAL_ORIGIN": "http://127.0.0.1:18763",
        "PORTAL_PORT": "18763",
    }
    with open("/tmp/knowledgeos-portal-acceptance.log", "w") as log:
        portal = subprocess.Popen(
            [sys.executable, "examples/intranet/server.py"],
            env=env,
            stdout=log,
            stderr=log,
        )
    for _ in range(100):
        try:
            if httpx.get("http://127.0.0.1:18763/health", timeout=1).status_code == 200:
                break
        except httpx.HTTPError:
            time.sleep(0.1)
    else:
        raise RuntimeError("Portal did not start")
    before = client.get("/api/admin/analytics").json()["query_count"]
    result = subprocess.run(
        ["node", "--input-type=module"],
        check=False,
        cwd=root / "frontend",
        env={
            **os.environ,
            "BROWSER_ADMIN": username,
            "BROWSER_PASSWORD": password,
            "BROWSER_INTEGRATION": integration_id,
            "BROWSER_TITLE": title,
            "BROWSER_MODE": expected_mode,
        },
        input=r"""
import {chromium} from '@playwright/test';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try {
const admin=await browser.newPage({viewport:{width:1440,height:1000}});
await admin.goto('http://localhost:8080/login');
await admin.getByLabel('Username',{exact:true}).fill(process.env.BROWSER_ADMIN);
await admin.getByLabel('Password',{exact:true}).fill(process.env.BROWSER_PASSWORD);
await admin.getByRole('button',{name:'Sign in',exact:true}).click();
await admin.getByRole('button',{name:'Sign out',exact:true}).waitFor();
await admin.goto('http://localhost:8080/integrations');
await admin.getByRole('heading',{name:'Integrations',exact:true}).waitFor();
await admin.getByText('Synthetic acceptance', {exact:false}).first().waitFor();
await admin.screenshot({path:'../docs/screenshots/enterprise-integrations.png',fullPage:true});
const employeeContext=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await employeeContext.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:18763');
await page.locator('#login-form button[type=submit]').click();
await page.locator('#dashboard').waitFor({state:'visible'});
const widget=page.locator('knowledgeos-chat');
await widget.getByRole('button',{name:'Open knowledge assistant',exact:true}).click();
await widget.getByRole('textbox',{name:'Ask your knowledge base'}).fill('What is the remote work policy?');
await widget.getByRole('button',{name:'Send question',exact:true}).click();
await widget.locator('.source').first().waitFor({state:'attached',timeout:90000});
await widget.locator('summary').first().click();
await widget.getByText(/three remote-work days/).first().waitFor();
const modeLabel=process.env.BROWSER_MODE==='grounded'?'Grounded answer':'generation disabled';
if(!await widget.locator('.mode').first().filter({hasText:modeLabel}).isVisible())throw new Error('Expected execution mode not displayed');
if(process.env.BROWSER_MODE==='grounded'&&!/\[1\]/.test(await widget.locator('.body').last().innerText()))throw new Error('Generated answer missing validated inline citation');
const denial=await page.request.get('http://localhost:8000/api/documents');if(denial.status()!==401)throw new Error('Employee gained admin access');
await page.screenshot({path:'../docs/screenshots/employee-intranet.png',fullPage:true});
await page.reload();await page.locator('#dashboard').waitFor({state:'visible'});
await widget.getByRole('button',{name:'Open knowledge assistant',exact:true}).click();
await widget.locator('.history option').nth(1).waitFor({state:'attached'});
await widget.locator('.history').selectOption({index:1});
await widget.locator('.source').first().waitFor({state:'attached'});
await page.setViewportSize({width:390,height:844});
await page.screenshot({path:'../docs/screenshots/employee-intranet-mobile.png',fullPage:true});
if(await page.evaluate(()=>localStorage.length))throw new Error('Unexpected browser storage');
if(errors.length)throw new Error(JSON.stringify(errors));
console.log(JSON.stringify({realIngestion:true,adminIntegrationsUI:true,portalIdentity:true,realAuthorizedRetrieval:true,citations:true,mode:process.env.BROWSER_MODE,reloadHistory:true,employeeDeniedAdmin:true,mobile390:true,pageErrors:errors}));
} finally {await browser.close();}
""",
        text=True,
    )
    assert result.returncode == 0, "Real browser acceptance failed"
    after = client.get("/api/admin/analytics").json()
    assert after["query_count"] > before and any(
        r["id"] == integration_id and r["count"] > 0
        for r in after["queries_by_integration"]
    )
    print("Actual persisted integration analytics verified.")
finally:
    if portal:
        portal.terminate()
        portal.wait(timeout=15)
    if integration_id:
        # Remove only synthetic verification conversations created by this integration.
        with Session(engine()) as db:
            from app.models import Conversation, Message

            ids = list(
                db.scalars(
                    select(Conversation.id).where(
                        Conversation.integration_id == integration_id
                    )
                )
            )
            if ids:
                db.execute(delete(Message).where(Message.conversation_id.in_(ids)))
                db.execute(delete(Conversation).where(Conversation.id.in_(ids)))
            db.commit()
        if key_id:
            client.delete(f"/api/admin/integrations/{integration_id}/keys/{key_id}")
        client.patch(
            "/api/admin/integrations/" + integration_id, json={"enabled": False}
        )
    if document_id:
        client.delete("/api/documents/" + document_id)
    client.close()
    if operator_id:
        with Session(engine()) as db:
            db.execute(
                update(SecurityAudit)
                .where(SecurityAudit.admin_id == operator_id)
                .values(admin_id=None)
            )
            db.execute(delete(AdminSession).where(AdminSession.admin_id == operator_id))
            db.execute(delete(Admin).where(Admin.id == operator_id))
            db.commit()
