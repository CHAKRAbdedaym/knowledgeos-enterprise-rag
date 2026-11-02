import secrets
import sys
import pytest
from sqlalchemy import select
from app import admin_cli
from app.models import Admin


def test_interactive_bootstrap_stores_only_hash(client, monkeypatch, capsys):
    password = secrets.token_urlsafe(24)
    with client.db_sessions() as db:
        bind = db.get_bind()
    monkeypatch.setattr(admin_cli, "engine", lambda: bind)
    monkeypatch.setattr(sys.stdin, "isatty", lambda: True)
    monkeypatch.setattr(sys, "argv", ["admin_cli", "--username", "New-Admin"])
    monkeypatch.setattr(admin_cli.getpass, "getpass", lambda _: password)
    admin_cli.main()
    with client.db_sessions() as db:
        admin = db.scalar(select(Admin).where(Admin.username == "new-admin"))
        assert admin_cli.hasher.verify(admin.password_hash, password)
    assert password not in capsys.readouterr().out
    # Reusing the command never overwrites an existing password.
    with pytest.raises(SystemExit):
        admin_cli.main()


def test_bootstrap_refuses_noninteractive_input(monkeypatch):
    monkeypatch.setattr(sys.stdin, "isatty", lambda: False)
    monkeypatch.setattr(sys, "argv", ["admin_cli"])
    with pytest.raises(SystemExit) as result:
        admin_cli.main()
    assert result.value.code == 2
