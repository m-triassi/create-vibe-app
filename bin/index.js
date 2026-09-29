#!/usr/bin/env node

import fs from "fs-extra";
import path from "path";
import degit from "degit";
import chalk from "chalk";
import fg from "fast-glob";
import { confirm, input, password } from "@inquirer/prompts";
import { spawnSync } from "child_process";

const REPO_URL = "m-triassi/ai-react-template";
const PLACEHOLDERS = [":application_title", ":author_name"];
const BINARY_EXTENSIONS = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".ico",
    ".woff",
    ".woff2",
    ".eot",
    ".ttf",
    ".otf",
    ".DS_Store",
]);

const formatDefault = (placeholder) =>
    placeholder
        .replace(/^:/, "")
        .split("_")
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join(" ");
const KEBAB_OR_SNAKE_CASE = /^[a-z0-9]+([-_][a-z0-9]+)*$/;
const isBinary = (filePath) => BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase());
const commandExists = (command) => spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;
const applyReplacements = (value, replacements) =>
    Object.entries(replacements).reduce((result, [from, to]) => result.replaceAll(from, to), value);

function run(command, args, cwd) {
    const { status, error } = spawnSync(command, args, { cwd, stdio: "inherit" });
    if (error || status) throw error || new Error(`${command} exited with code ${status}`);
}

function printManualCloudflareInstructions(step) {
    console.log(`${step}. ${chalk.cyan("Create Cloudflare Pages Project:")}`);
    console.log("   - Go to your Cloudflare dashboard and create a new Pages project.");
    console.log("   - Choose the option to upload files directly.");
    console.log("   - Once created you may exit the page, as the GitHub action will upload the files for you.\n");
}

function printManualGitHubInstructions(step, ghInstalled) {
    console.log(`${step}. ${chalk.cyan("Set GitHub Repository Secrets:")}`);

    if (ghInstalled) {
        console.log("   - Optional CLI path from inside the project folder:");
        console.log(`     ${chalk.green("gh repo create --source . --remote origin")}`);
        console.log(`     ${chalk.green("gh secret set CLOUDFLARE_API_TOKEN")}`);
        console.log(`     ${chalk.green("gh secret set CLOUDFLARE_ACCOUNT_ID\n")}`);
    }

    console.log(
        `   - In your GitHub repo, go to: ${chalk.green("Settings > Secrets and variables > Actions")}`,
    );
    console.log(`   - Click ${chalk.green("New repository secret")} and add the following:\n`);
    console.log(`   - ${chalk.green("CLOUDFLARE_API_TOKEN")}`);
    console.log("     (Create a token in Cloudflare with 'Edit Cloudflare Pages' permissions)\n");
    console.log(`   - ${chalk.green("CLOUDFLARE_ACCOUNT_ID")}`);
    console.log("     (Find this on your main Cloudflare dashboard page)");
}

async function main() {
    console.log(chalk.cyan("\n--- React Project Initializer ---\n"));

    const replacements = {};
    for (const placeholder of PLACEHOLDERS) {
        const isApplicationTitle = placeholder === ":application_title";
        replacements[placeholder] = await input({
            message: `Enter value for ${chalk.yellow(placeholder)}:`,
            default: isApplicationTitle ? "my-vibe-app" : formatDefault(placeholder),
            validate: isApplicationTitle
                ? (value) =>
                      KEBAB_OR_SNAKE_CASE.test(value.trim()) ||
                      "Must be kebab-case or snake_case (lowercase letters, numbers, - or _), e.g. my-vibe-app."
                : undefined,
        });
    }
    const projectDirName = replacements[":application_title"];
    const targetDir = path.join(process.cwd(), projectDirName);

    console.log(chalk.cyan("\n--- Starting Initialization ---"));
    console.log(`Downloading template to ${chalk.green(targetDir)}...`);

    try {
        await degit(REPO_URL, { cache: false, force: true }).clone(targetDir);
    } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
    }

    console.log("1. Replacing placeholder text in file contents...");
    for (const file of await fg(["**/*"], { cwd: targetDir, dot: true, ignore: [".git"], absolute: true })) {
        if (isBinary(file)) continue;
        try {
            const content = await fs.readFile(file, "utf8");
            const next = applyReplacements(content, replacements);
            if (next !== content) await fs.writeFile(file, next, "utf8");
        } catch {}
    }
    console.log("File content replacement complete.");

    console.log("2. Renaming files and directories...");
    const paths = await fg(["**/*"], {
        cwd: targetDir,
        dot: true,
        ignore: [".git"],
        onlyFiles: false,
        absolute: false,
    });

    for (const relativePath of paths.sort((a, b) => b.length - a.length)) {
        const nextName = applyReplacements(path.basename(relativePath), replacements);
        if (nextName === path.basename(relativePath)) continue;
        const from = path.join(targetDir, relativePath);
        if (await fs.pathExists(from)) await fs.rename(from, path.join(targetDir, path.dirname(relativePath), nextName));
    }
    console.log("File and directory renaming complete.");

    console.log("3. Updating README.md...");
    const readmePath = path.join(targetDir, "README.md");
    if (await fs.pathExists(readmePath)) {
        const [, ...rest] = (await fs.readFile(readmePath, "utf8")).split(/^---$/m);
        if (rest.length) {
            await fs.writeFile(readmePath, rest.join("---").trim(), "utf8");
            console.log("README.md section removed.");
        } else {
            console.warn(chalk.yellow('WARN: Separator "---" not found in README. Skipping truncation.'));
        }
    } else {
        console.warn(chalk.yellow("WARN: README.md not found."));
    }

    console.log("4. Checking for Cloudflare Wrangler CLI...");
    const wranglerInstalled = commandExists("wrangler");
    let cloudflareProjectCreated = false;

    if (wranglerInstalled) {
        console.log(`   ${chalk.green("Wrangler CLI found.")}`);
        if (await confirm({ message: "Would you like to create a Cloudflare Pages project now?", default: true })) {
            console.log("   Launching Wrangler Pages project creation flow...");
            try {
                run("wrangler", ["pages", "project", "create", projectDirName, "--production-branch", "main"], targetDir);
                cloudflareProjectCreated = true;
                console.log(chalk.green(`   Successfully created Cloudflare Pages project: ${projectDirName}`));
            } catch {
                console.log(chalk.yellow("   Wrangler command failed. You can create it manually."));
            }
        } else {
            console.log("   Skipping Cloudflare Pages project creation.");
        }
    } else {
        console.log(chalk.yellow("   Wrangler CLI not found. Skipping automatic project creation."));
    }

    await fs.remove(path.join(targetDir, "init.sh"));

    console.log("5. Checking for GitHub CLI...");
    const ghInstalled = commandExists("gh");
    let githubSecretsConfigured = false;

    if (ghInstalled) {
        console.log(`   ${chalk.green("GitHub CLI found.")}`);
        if (await confirm({
            message: "Would you like to initialize git, create a GitHub repo, and set Cloudflare secrets now?",
            default: true,
        })) {
            if (!commandExists("git")) {
                console.log(chalk.yellow("   Git is not installed. Skipping GitHub repository setup."));
            } else {
                if (!(await fs.pathExists(path.join(targetDir, ".git")))) {
                    console.log("   Initializing local git repository...");
                    try {
                        run("git", ["init", "-b", "main"], targetDir);
                    } catch {
                        run("git", ["init"], targetDir);
                        run("git", ["branch", "-M", "main"], targetDir);
                    }
                }

                console.log("   Launching GitHub CLI repository creation flow...");
                try {
                    run("gh", ["repo", "create", "--source", ".", "--remote", "origin"], targetDir);

                    const secrets = {
                        CLOUDFLARE_API_TOKEN: await password({
                            message: "Enter CLOUDFLARE_API_TOKEN:",
                            mask: "*",
                            validate: (value) => value.trim() || "CLOUDFLARE_API_TOKEN is required.",
                        }),
                        CLOUDFLARE_ACCOUNT_ID: await input({
                            message: "Enter CLOUDFLARE_ACCOUNT_ID:",
                            validate: (value) => value.trim() || "CLOUDFLARE_ACCOUNT_ID is required.",
                        }),
                    };

                    for (const [name, value] of Object.entries(secrets)) {
                        run("gh", ["secret", "set", name, "--body", value], targetDir);
                    }

                    githubSecretsConfigured = true;
                    console.log(chalk.green("   GitHub repository secrets configured successfully."));
                } catch {
                    console.log(chalk.yellow("   GitHub repository creation was skipped, failed, or secrets could not be set."));
                }
            }
        } else {
            console.log("   Skipping GitHub CLI setup.");
        }
    } else {
        console.log(chalk.yellow("   GitHub CLI not found. Skipping automatic GitHub repository setup."));
    }

    console.log(chalk.green("\n--- Initialization Complete! ---\n"));

    if (!cloudflareProjectCreated || !githubSecretsConfigured) {
        console.log(chalk.yellow("!!! ACTION REQUIRED !!!"));
        console.log("--------------------------------------------------------------------------");
        console.log("To enable deployments, complete the remaining setup steps:\n");

        let step = 1;
        if (!cloudflareProjectCreated) printManualCloudflareInstructions(step++);
        if (!githubSecretsConfigured) printManualGitHubInstructions(step, ghInstalled);

        console.log("--------------------------------------------------------------------------\n");
    } else {
        console.log(chalk.green("Cloudflare Pages project is ready and GitHub secrets are configured.\n"));
    }

    console.log("Next steps:");
    console.log(`  cd ${projectDirName}`);
    console.log("  npm install");
    console.log("  npm run dev\n");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
