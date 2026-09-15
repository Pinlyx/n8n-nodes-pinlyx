# n8n-nodes-crmsolid

An [n8n](https://n8n.io) community node for [Pinlyx](https://pinlyx.com). It puts your
contacts, deals and conversations in a workflow, so a form submission becomes a contact, a
won deal triggers an invoice, and an inbox message reaches whatever you have wired up next.

n8n is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation
platform.

[Installation](#installation) · [Operations](#operations) · [Credentials](#credentials) ·
[Compatibility](#compatibility) · [Resources](#resources)

## Installation

In n8n, go to **Settings → Community Nodes**, select **Install**, and enter:

```
n8n-nodes-crmsolid
```

For a self-hosted instance you can also install it directly:

```bash
npm install n8n-nodes-crmsolid
```

Follow the [community node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/)
if your instance is locked down.

## Operations

**Contact**

- **Create** a contact. At least one of name, username, phone, email or external ID is
  required. Setting **External ID** is what keeps a re-run from creating a second copy of
  the same person.
- **Get** one contact by ID.
- **Get Many** with filters: search, platform, email, external ID, and **Updated Since**,
  which is the filter an incremental sync runs on.
- **Update** any field on a contact.
- **Delete** a contact. This archives rather than erases: message history and linked deals
  survive, matching what the platform itself does.

**Deal**

- **Create** a deal with title, value, currency, stage, probability, expected close date
  and notes. A deal cannot be created already won or lost.
- **Get Many** with filters for stage, contact and a title search.

**Conversation**

- **Get Many** conversations across every connected channel.

List operations follow the API's cursor pagination. Turn on **Return All** to walk every
page, or leave it off and set a limit.

## Credentials

You need a Pinlyx account and an API key.

1. In Pinlyx, open **Settings → Developers**.
2. Create a key. It starts with `csk_live_` or `csk_test_`.
3. Grant it the scopes this workflow needs, for example `contacts:read` and
   `contacts:write`.
4. In n8n, add a **Pinlyx API** credential and paste the key.

Scopes are enforced server side, so a key without `contacts:write` will fail create and
update with a 403 rather than silently doing nothing. **Base URL** only needs changing for
a staging or self-hosted deployment.

## Compatibility

Tested against n8n 1.60 and later, on Node.js 20.15+. The node has no runtime
dependencies: every request goes through n8n's own HTTP helper.

## Resources

- [Pinlyx](https://pinlyx.com)
- [API documentation](https://docs.pinlyx.com)
- [`@crmsolid/mcp-server`](https://github.com/Pinlyx/pinlyx-mcp): the MCP server,
  for the same CRM from Claude, Cursor or ChatGPT rather than from a workflow
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

## Licence

[MIT](LICENSE)
