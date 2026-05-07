# hitokoto-api-worker

Cloudflare Workers implementation of the [Hitokoto](https://hitokoto.cn/) API.

Sentences data is sourced from [hitokoto-osc/sentences-bundle](https://github.com/hitokoto-osc/sentences-bundle) and bundled directly into the Worker — no external database required.

## API Usage

### Get a random hitokoto

```
GET /
```

#### Query Parameters

| Parameter    | Type   | Default     | Description                                                                                  |
| ------------ | ------ | ----------- | -------------------------------------------------------------------------------------------- |
| `c`          | string | (all)       | Category key(s). Can be specified multiple times: `?c=a&c=b`. See [Categories](#categories). |
| `encode`     | string | `json`      | Response format: `json`, `js`, or `text`.                                                    |
| `select`     | string | `.hitokoto` | CSS selector used by the `js` encoder to inject text into the DOM.                           |
| `min_length` | number | `0`         | Minimum sentence length (characters).                                                        |
| `max_length` | number | `30`        | Maximum sentence length (characters). Range: 0–10000.                                        |

#### Response (JSON)

```json
{
  "id": 1,
  "uuid": "9818ecda-9cbf-4f2a-9af8-8136ef39cfcd",
  "hitokoto": "与众不同的生活方式很累人呢，因为找不到借口。",
  "type": "a",
  "from": "幸运星",
  "from_who": null,
  "creator": "跳舞的果果",
  "creator_uid": 0,
  "reviewer": 0,
  "commit_from": "web",
  "created_at": "1468605909",
  "length": 22
}
```

#### Examples

```bash
# Random hitokoto (JSON)
curl https://<your-worker>.workers.dev/

# Random anime sentence as plain text
curl "https://<your-worker>.workers.dev/?c=a&encode=text"

# JavaScript snippet (inject into DOM element with class .hitokoto)
curl "https://<your-worker>.workers.dev/?encode=js&select=.hitokoto"

# Sentences between 10 and 25 characters from anime or comic categories
curl "https://<your-worker>.workers.dev/?c=a&c=b&min_length=10&max_length=25"
```

### Other endpoints

| Path              | Description                                     |
| ----------------- | ----------------------------------------------- |
| `GET /status`     | Bundle version and per-category sentence counts |
| `GET /categories` | Full list of categories with metadata           |

---

## Categories

| Key | Name   | Description                      |
| --- | ------ | -------------------------------- |
| `a` | 动画   | Anime                            |
| `b` | 漫画   | Comic                            |
| `c` | 游戏   | Game                             |
| `d` | 文学   | Literature                       |
| `e` | 原创   | Original                         |
| `f` | 网络   | Internet                         |
| `g` | 其他   | Other                            |
| `h` | 影视   | Video                            |
| `i` | 诗词   | Poem                             |
| `j` | 网易云 | NetEase Cloud Music hot comments |
| `k` | 哲学   | Philosophy                       |
| `l` | 抖机灵 | Funny                            |

---

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Cloudflare account](https://dash.cloudflare.com/) (for deployment)

### Setup

```bash
# Install dependencies
npm install

# (Optional) Refresh the bundled sentences from the upstream repository
npm run fetch-sentences
```

### Run locally

```bash
npm run dev
```

### Type-check

```bash
npm run typecheck
```

### Deploy to Cloudflare Workers

```bash
# Authenticate with Cloudflare first (one-time)
npx wrangler login

npm run deploy
```

---

## Updating sentences

The sentence data lives in `src/data/` and is committed to the repository so the Worker can be built and deployed without network access to GitHub.

To pull the latest sentences from [hitokoto-osc/sentences-bundle](https://github.com/hitokoto-osc/sentences-bundle):

```bash
npm run fetch-sentences
# Review the changes, then commit
git add src/data/
git commit -m "chore: update sentences bundle"
```

---

## License

MIT
