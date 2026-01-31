# Cursor 2-Day AI Hackathon — Repo Template

![Cursor 2-Day AI Hackathon](https://ai-beavers.com/_next/image?url=%2Fimages%2Fhackathon-hero-20012026.png&w=1920&q=75)

**How to use this template:**
1. Click "Use this template" → "Create a new repository"
2. Name your repo and set it to **Public**
3. Replace this section with your project name and description

---

# FeynMap

FeynMap - An AI coach that makes you explain concepts, detects gaps in understanding, and shows your knowledge as an unlockable map.

## Tech Stack

What technologies power your project?

<!-- List your main technologies, frameworks, and services -->

- **Frontend**: React-Router v7
- **Backend**: React-Router v7
- **Database**: PostgreSQL
- **AI/ML**: e.g., OpenAI GPT-4, Gemini Pro
- **Hosting**: fly.io

## How to Run

Step-by-step instructions to run the project locally, including everything that needs to be set up.

### Install postgres and set up the databse:

on mac:
```
brew install postgresql@18
```

Other platforms: https://www.postgresql.org/download/

#### create a db
```bash
psql -U postgres

CREATE DATABASE feynmap;

```

Then exit the psql shell.

#### clone the repo and run it

```bash
# Clone the repo
git clone git@github.com:FeynMap/feynmap.git
cd feynmap

# Install pnpm: follow https://pnpm.io/installation

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Add your API keys to .env

# setup db
pnpm db:migrate

# Run the development server
pnpm dev
```

## Details

Add anything else you want to share: architecture diagrams, screenshots, challenges faced, future plans, etc.
