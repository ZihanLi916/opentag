-- Freeze the effective configuration of existing mounts without changing authorization or probes.
-- COALESCE preserves explicit empty prefixes and empty header maps.
UPDATE "agent_mcp_servers" AS binding
SET "url_override" = COALESCE(binding."url_override", server."url"),
    "auth_header_override" = COALESCE(binding."auth_header_override", server."auth_header"),
    "auth_scheme_override" = COALESCE(binding."auth_scheme_override", server."auth_scheme"),
    "extra_headers_override" = COALESCE(binding."extra_headers_override", server."extra_headers")
FROM "mcp_servers" AS server
WHERE binding."mcp_server_id" = server."id";
