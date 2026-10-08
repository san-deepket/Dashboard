# Rathor Task Tracker (Vercel + Redis database + Nvidia assistant)

Tasks are stored in a cloud database, so every browser and device shows the same data.

Files:
- `index.html`        the tracker website, with the assistant panel
- `api/tasks.js`      saves and loads tasks in the Redis database
- `api/assistant.js`  talks to Gemini for the assistant (holds the Gemini key)
- `package.json`      tells Vercel to use Node 18 or newer

## Deploy

1. Put these files at the root of a GitHub repo (index.html, api/, package.json) and push.
2. On https://vercel.com choose Add New, Project, import the repo, and click Deploy.
3. Connect the database:
   - Open the project, go to the Storage tab, click Create Database.
   - Choose Upstash for Redis, pick the free plan, and connect it to this project.
   - Vercel adds the database variables automatically. The code accepts both
     UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN and KV_REST_API_URL / KV_REST_API_TOKEN.
4. Open Settings, Environment Variables, and add:
   - `ACCESS_CODE`     any word you choose (strongly recommended, see below)
   - `NVIDIA_API_KEY`  free key from https://aistudio.google.com/apikey (only for the assistant)
   - `NVIDIA_MODEL`    optional, defaults to gemini-2.5-flash
5. Open Deployments and Redeploy so the variables take effect.

## How it behaves

- The first time a browser opens the site it asks for the access code (once per browser).
- Tasks already saved in a browser are copied into the database the first time, so nothing is lost.
- Changes show in other open browsers within about 15 seconds, or right away when you switch back to the tab.
- A small label near the top shows Saving, Saved or Offline. If the connection drops, changes are kept and sent when it returns.
- If two people edit the same task at the same moment, the last save wins.

## Important

- Set ACCESS_CODE. Without it, anyone who finds the site address can read and change the tasks and use your Gemini quota.
- The access code is a simple shared password, not a user login. Share it only with people who should see the tasks.
- The assistant sends task titles, dates and assigned names to Gemini. Free-tier content can be used by Google to improve its products, so keep sensitive details out of tasks.
- Never put API keys inside index.html.
