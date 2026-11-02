"""Default-deny integration ACLs and employee ownership; preserve existing corpus."""

from alembic import op
import sqlalchemy as sa

revision = "0003_enterprise_integrations"
down_revision = "0002_admin_auth"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("runtime_settings", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("values", sa.JSON(), nullable=False))
    op.create_table(
        "integrations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("allowed_origins", sa.JSON(), nullable=False),
        sa.Column("rate_limit_per_minute", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "integration_documents",
        sa.Column("integration_id", sa.String(36), sa.ForeignKey("integrations.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("document_id", sa.String(36), sa.ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_table(
        "integration_keys",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("integration_id", sa.String(36), sa.ForeignKey("integrations.id"), nullable=False),
        sa.Column("secret_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("scopes", sa.JSON(), nullable=False),
        sa.Column("prefix", sa.String(16), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("last_used_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_integration_keys_integration_id", "integration_keys", ["integration_id"])
    op.create_table(
        "employees",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("integration_id", sa.String(36), sa.ForeignKey("integrations.id"), nullable=False),
        sa.Column("external_subject", sa.String(160), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("integration_id", "external_subject", name="employee_subject_per_integration"),
    )
    op.create_index("ix_employees_integration_id", "employees", ["integration_id"])
    op.create_table(
        "widget_sessions",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("integration_id", sa.String(36), sa.ForeignKey("integrations.id"), nullable=False),
        sa.Column("key_id", sa.String(36), sa.ForeignKey("integration_keys.id"), nullable=False),
        sa.Column("employee_id", sa.String(36), sa.ForeignKey("employees.id"), nullable=False),
        sa.Column("origin", sa.String(300), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    for field in ["integration_id", "key_id", "employee_id", "expires_at"]:
        op.create_index("ix_widget_sessions_" + field, "widget_sessions", [field])
    op.create_table(
        "security_audit",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("admin_id", sa.String(36), sa.ForeignKey("admins.id")),
        sa.Column("integration_id", sa.String(36), sa.ForeignKey("integrations.id")),
        sa.Column("action", sa.String(80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.add_column("documents", sa.Column("employee_available", sa.Boolean(), nullable=False, server_default=sa.false()))
    with op.batch_alter_table("conversations") as batch:
        batch.add_column(sa.Column("integration_id", sa.String(36)))
        batch.add_column(sa.Column("employee_id", sa.String(36)))
        batch.create_foreign_key("fk_conversation_integration", "integrations", ["integration_id"], ["id"])
        batch.create_foreign_key("fk_conversation_employee", "employees", ["employee_id"], ["id"])
        batch.create_check_constraint(
            "conversation_owner_pair",
            "(integration_id IS NULL AND employee_id IS NULL) OR (integration_id IS NOT NULL AND employee_id IS NOT NULL)",
        )
        batch.create_index("ix_conversations_integration_id", ["integration_id"])
        batch.create_index("ix_conversations_employee_id", ["employee_id"])
    with op.batch_alter_table("query_logs") as batch:
        batch.add_column(sa.Column("integration_id", sa.String(36)))
        batch.add_column(sa.Column("channel", sa.String(20), nullable=False, server_default="admin"))
        batch.create_foreign_key("fk_query_integration", "integrations", ["integration_id"], ["id"])
        batch.create_index("ix_query_logs_integration_id", ["integration_id"])


def downgrade():
    raise RuntimeError("Downgrade requires an explicit employee-data export and reviewed migration; no destructive automatic downgrade.")
