# @m-triassi/create-vibe-app

I built this CLI because I got tired of manually cloning my template repository every time I started a new AI-generated project.

Most React starters are either too heavy (Next.js) or require too much configuration after the fact. This tool does one thing: it scaffolds a lightweight React 19 + Tailwind CSS project designed specifically for "vibe coding"—where you ask an LLM to generate the app and you just need a place to paste the code.

## Usage

You don't need to install anything globally. Just run:

```bash
npx @m-triassi/create-vibe-app
```

## What it actually does

When you run the command, the script executes a sequence that mimics a manual setup, but faster and less prone to user error:

1. **Downloads the template**: It pulls m-triassi/ai-react-template using degit. This gives you a fresh folder without my git history attached.
2. **Asks for details**: It prompts for a project name and author.
3. **Finds and replaces**: It scans the directory and swaps out placeholders (like :application_title) in both file contents and filenames. It's smart enough to skip binary files so it doesn't corrupt your images.
4. **Cleans up**: It removes the init.sh script that comes with the raw template because you don't need it anymore.
5. **Cloudflare setup**: It checks if you have wrangler installed. If you do, it tries to create a new Cloudflare Pages project for you immediately.

## Deploying to Cloudflare

The template includes a GitHub Action for automatic deployment, but it needs permission to talk to your Cloudflare account.

After the CLI finishes, you need to add two secrets to your new GitHub repository:

`CLOUDFLARE_ACCOUNT_ID`: Found on the right sidebar of your Cloudflare Workers & Pages dashboard.

`CLOUDFLARE_API_TOKEN`: You need to generate this in your user profile. Make sure it has "Edit" permissions for Cloudflare Pages.

Once those are set, every push to main deploys your site.

## Why "Vibe Coding"?

I noticed that when I use models like Gemini or Claude to write software, I don't want a complex directory structure. I want a simple App.jsx and a vite.config.js that stays out of the way.

This starter is intentionally minimal. It doesn't include a router, a state management library, or testing frameworks by default. It's just enough code to get the LLM's output onto a screen.
