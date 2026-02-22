# ArcGIS API Key Management — REST API Reference

> **Purpose:** Exact HTTP calls required to create, regenerate, and revoke ArcGIS API keys. Intended as a reference for implementing application logic.
>
> **Note:** Many parameters contain hardcoded values that are fixed by the ArcGIS platform. Variables are shown as `{{variable-name}}`.

---

## Concepts

- **API key item**: An ArcGIS item of type `Application` that acts as a container for up to two API key slots.
- **Slot 1 (primary)**: The first API key slot, identified by `apiToken=1`.
- **Slot 2 (secondary)**: The second API key slot, identified by `apiToken=2`.
- **resource-owner-token**: A short-lived token obtained via username/password. **OAuth tokens do NOT work** for key management operations.
- **client_id / client_secret**: Returned when an item is registered as an app. Used to generate and regenerate the actual API key string.

---

## Variable Reference

| Variable | Description |
| --- | --- |
| `{{username}}` | ArcGIS username |
| `{{password}}` | ArcGIS password |
| `{{resource-owner-token}}` | Token from the `generateToken` call |
| `{{item-id}}` | Item ID returned by `addItem` |
| `{{client_id}}` | `client_id` returned by `registerApp` |
| `{{client_secret}}` | `client_secret` returned by `registerApp` |
| `{{title}}` | Display name for the API key |
| `{{snippet}}` | Short description for the API key |
| `{{expiration-ms}}` | Expiration timestamp in milliseconds (e.g. `moment().add(363, 'days').unix() * 1000`) |

---

## Base URLs by Environment

| Environment | Base URL |
|---|---|
| ArcGIS Online | `https://www.arcgis.com/sharing/rest` |
| Location Platform | `https://www.arcgis.com/sharing/rest` |
| Enterprise | `https://<your-portal>/portal/sharing/rest` |

> `subscriptionType` and other parameters may differ per environment. The examples below use ArcGIS Online / Location Platform values.

---

## Operation Flow Summary

```
Create API key (5 steps)
  1. generateToken (username/password)       → resource-owner-token
  2. addItem (type=Application)              → item-id
  3. registerApp (itemId)                    → client_id, client_secret
  4. update item (set expiration date)       → success
  5. oauth2/token (regenerateApiToken=false) → access_token (= the API key string)

Regenerate an existing API key (2 steps)
  1. update item (set new expiration date)   → success
  2. oauth2/token (regenerateApiToken=true)  → access_token (= new API key string)

Revoke an API key (1 step)
  1. revokeToken (client_id, client_secret, apiToken slot) → success
```

> All operations except Revoke require a `resource-owner-token`. Obtain one with the `generateToken` call before starting any flow.

---

## Operation: Create an API Key

Creates a new ArcGIS Application item, registers it as an API key app, and issues the key for the first time. Requires 5 sequential calls. Use **Regenerate** for existing items.

### Step 1 — Get a resource-owner-token

**Endpoint:** `POST https://arcgis.com/sharing/rest/generateToken`

```
Content-Type: application/x-www-form-urlencoded

f=json
username={{username}}
password={{password}}
expiration=
```

> `expiration=` left empty uses the server default. This token is short-lived and scoped to key management.

**Response:**

```json
{
    "token": "{{resource-owner-token}}",
    "expires": 1771632722166,
    "ssl": true
}
```

---

### Step 2 — Create an item of type Application

> Creates the ArcGIS item that will back the API key.

**Endpoint:** `POST https://www.arcgis.com/sharing/rest/content/users/{{username}}/addItem`

```
Content-Type: application/x-www-form-urlencoded

f=json
token={{resource-owner-token}}
type=Application
typeKeywords=[]
title={{title}}
snippet={{snippet}}
tags=
subscriptionType=locationPlatform
isPersonalAPIToken=false
```

> **Set `apiToken1ExpirationDate` here.** And also via the update call in Step 4. 

**Response:**

```json
{
    "folder": "",
    "id": "{{item-id}}",
    "success": true
}
```

---

### Step 3 — Register the item as an API key app

> Links the item to the OAuth system, assigns privileges, and returns the `client_id`/`client_secret` needed to generate and regenerate the key.

**Endpoint:** `POST https://www.arcgis.com/sharing/rest/oauth2/registerApp`

```
Content-Type: application/x-www-form-urlencoded

f=json
token={{resource-owner-token}}
itemId={{item-id}}
appType=multiple
redirect_uris=["urn:ietf:wg:oauth:2.0:oob"]
httpReferrers=[]
privileges=["premium:user:basemaps","premium:user:staticbasemaptiles"]
```

**Response:**

```json
{
    "itemId": "{{item-id}}",
    "client_id": "{{client_id}}",
    "client_secret": "{{client_secret}}",
    "appType": "multiple",
    "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob"],
    "registered": 1771626298000,
    "modified": 1771626298000,
    "httpReferrers": [],
    "privileges": [
        "premium:user:basemaps",
        "premium:user:staticbasemaptiles"
    ],
    "isPersonalAPIToken": false
}
```

> **Persist `client_id` and `client_secret`.** They are required for Step 5 and for all future regeneration and revocation calls.

---

### Step 4 — Set the expiration date

> Must be called before generating the key. Sets when the API key expires.

**Endpoint:** `POST https://arcgis.com/sharing/rest/content/users/{{username}}/items/{{item-id}}/update`

```
Content-Type: application/x-www-form-urlencoded

f=json
token={{resource-owner-token}}
apiToken1ExpirationDate={{expiration-ms}}
```

> Use `apiToken1ExpirationDate` for slot 1 (primary) or `apiToken2ExpirationDate` for slot 2 (secondary).

**Response:**

```json
{
    "id": "{{item-id}}",
    "success": true
}
```

---

### Step 5 — Generate the API key string

> Uses the `client_id`/`client_secret` from Step 3 to issue the actual API key.

**Endpoint:** `POST https://www.arcgis.com/sharing/rest/oauth2/token`

```
Content-Type: application/x-www-form-urlencoded

f=json
client_id={{client_id}}
client_secret={{client_secret}}
grant_type=client_credentials
token={{resource-owner-token}}
apiToken=1
regenerateApiToken=false
```

> Use `apiToken=1` for slot 1 (primary) or `apiToken=2` for slot 2 (secondary).
> Use `regenerateApiToken=false` when generating a key for the first time.

**Response:**

```json
{
    "access_token": "{{API-key}}",
    "expires_in": 31362539
}
```

> The `access_token` value **is** the API key string.

---

## Operation: Regenerate an API Key

Applies to an **already-existing** item with a registered app. Re-issues the key for a given slot without creating a new item.

**Slot 1 = primary key · Slot 2 = secondary key**

### Step 1 — Update the expiration date

Same call as [Create → Step 4](#step-4--set-the-expiration-date). Use `apiToken1ExpirationDate` or `apiToken2ExpirationDate` depending on the slot being regenerated.

### Step 2 — Generate the new key

Same endpoint as [Create → Step 5](#step-5--generate-the-api-key), with one difference:

| Parameter | First-time generate | Regenerate |
|---|---|---|
| `apiToken` | `1` or `2` | `1` or `2` |
| `regenerateApiToken` | `false` | `true` |

**Example — regenerating slot 1:**

**Endpoint:** `POST https://www.arcgis.com/sharing/rest/oauth2/token`

```
Content-Type: application/x-www-form-urlencoded

f=json
client_id={{client_id}}
client_secret={{client_secret}}
grant_type=client_credentials
token={{resource-owner-token}}
apiToken=1
regenerateApiToken=true
```

**Response:** same shape as [Create → Step 5](#step-5--generate-the-api-key).

---

## Operation: Revoke an API Key

Invalidates a specific key slot without deleting the item or its registration.

**Endpoint:** `POST https://arcgis.com/sharing/rest/oauth2/revokeToken`

```
Content-Type: application/x-www-form-urlencoded

f=json
token={{resource-owner-token}}
client_id={{client_id}}
client_secret={{client_secret}}
apiToken=1
```

> Use `apiToken=1` for slot 1 (primary) or `apiToken=2` for slot 2 (secondary).
