#!/usr/bin/env node

import fs from "fs-extra";
import path from "path";
import degit from "degit";
import chalk from "chalk";
import fg from "fast-glob";
import { input } from "@inquirer/prompts";
import { execSync } from "child_process";

// --- Configuration matching init.sh ---
const REPO_URL = "m-triassi/ai-react-template";
const PLACEHOLDERS = [":application_title", ":author_name"];

// Binary extensions to exclude from text replacement (matching init.sh)
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

// --- Helper Functions ---

// Formats ":application_title" -> "Application Title" for the prompt default
function formatDefault(placeholder) {
    return placeholder
        .replace(/^:/, "")
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

// Check if a file is binary based on extension
function isBinary(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return BINARY_EXTENSIONS.has(ext);
}

// --- Main Script ---

async function main() {
    console.log(chalk.cyan("\n--- React Project Initializer ---\n"));

    // 1. Get Inputs (Replicates the "Read User Values" loop)
    const replacements = new Map();
    let projectDirName = "";

    for (const placeholder of PLACEHOLDERS) {
        const defaultVal = formatDefault(placeholder);

        const answer = await input({
            message: `Enter value for ${chalk.yellow(placeholder)}:`,
            default: defaultVal,
        });

        replacements.set(placeholder, answer);

        // Capture the application title to use as the directory name
        if (placeholder === ":application_title") {
            projectDirName = answer.trim().replace(/\s+/g, "-").toLowerCase();
        }
    }

    // Fallback if project name is somehow empty
    if (!projectDirName) projectDirName = "my-vibe-app";

    const targetDir = path.join(process.cwd(), projectDirName);

    // 2. Clone Repository
    console.log(chalk.cyan(`\n--- Starting Initialization ---`));
    console.log(`Downloading template to ${chalk.green(targetDir)}...`);

    const emitter = degit(REPO_URL, { cache: false, force: true });

    try {
        await emitter.clone(targetDir);
    } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
    }

    // 3. Find and Replace in File Contents
    console.log("1. Replacing placeholder text in file contents...");

    // Get all files, ignoring .git and the binary extensions list
    const entries = await fg(["**/*"], {
        cwd: targetDir,
        dot: true,
        ignore: [".git"],
        absolute: true,
    });

    for (const file of entries) {
        if (isBinary(file)) continue;

        try {
            let content = await fs.readFile(file, "utf8");
            let changed = false;

            replacements.forEach((replacement, placeholder) => {
                // Global replace of all occurrences
                if (content.includes(placeholder)) {
                    content = content.replaceAll(placeholder, replacement);
                    changed = true;
                }
            });

            if (changed) {
                await fs.writeFile(file, content, "utf8");
            }
        } catch (err) {
            // Ignore directory read errors or permission issues gracefully
        }
    }
    console.log("File content replacement complete.");

    // 4. Find and Replace in Filenames/Directories
    // Logic: Sort by depth (deepest first) to ensure renaming a child
    // doesn't break the path for the parent (or vice versa).
    console.log("2. Renaming files and directories...");

    const allPaths = await fg(["**/*"], {
        cwd: targetDir,
        dot: true,
        ignore: [".git"],
        onlyFiles: false, // We need directories too
        absolute: false, // Relative paths are easier to manipulate here
    });

    // Sort: Longest paths first (deepest)
    allPaths.sort((a, b) => b.length - a.length);

    for (const relativePath of allPaths) {
        const oldFullPath = path.join(targetDir, relativePath);
        const dir = path.dirname(relativePath);
        const oldName = path.basename(relativePath);

        let newName = oldName;
        replacements.forEach((replacement, placeholder) => {
            if (newName.includes(placeholder)) {
                newName = newName.replaceAll(placeholder, replacement);
            }
        });

        if (newName !== oldName) {
            const newFullPath = path.join(targetDir, dir, newName);
            // Check if file still exists (it might not if it was inside a renamed folder)
            if (await fs.pathExists(oldFullPath)) {
                console.log(`   RENAMING: ${oldName} -> ${newName}`);
                await fs.rename(oldFullPath, newFullPath);
            }
        }
    }
    console.log("File and directory renaming complete.");

    // 5. Update README.md (Remove "Using this Template" section)
    console.log("3. Updating README.md...");
    const readmePath = path.join(targetDir, "README.md");

    if (await fs.pathExists(readmePath)) {
        const readmeContent = await fs.readFile(readmePath, "utf8");

        // Logic: Split by "---", drop the first part (instructions), keep the rest
        // This matches the `awk` command in your script
        const parts = readmeContent.split(/^---$/m); // Multiline regex for ---

        if (parts.length > 1) {
            // Rejoin parts starting from index 1 (effectively dropping index 0)
            const newContent = parts.slice(1).join("---").trim();
            await fs.writeFile(readmePath, newContent, "utf8");
            console.log("README.md section removed.");
        } else {
            console.warn(
                chalk.yellow(
                    'WARN: Separator "---" not found in README. Skipping truncation.',
                ),
            );
        }
    } else {
        console.warn(chalk.yellow("WARN: README.md not found."));
    }

    // 6. Cloudflare Wrangler Check
    console.log("4. Checking for Cloudflare Wrangler CLI...");
    let wranglerInstalled = false;
    try {
        execSync("wrangler --version", { stdio: "ignore" });
        wranglerInstalled = true;
    } catch (e) {
        wranglerInstalled = false;
    }

    if (wranglerInstalled) {
        console.log(
            `   ${chalk.green("Wrangler CLI found.")} Attempting to create Pages project...`,
        );
        const appTitle = replacements.get(":application_title");

        try {
            // Execute standard input 'y' just in case it prompts for auth/confirmation
            execSync(
                `wrangler pages project create "${appTitle}" --production-branch main`,
                {
                    stdio: "inherit",
                    cwd: targetDir, // Run this INSIDE the new folder? No, usually runs globally, but let's be safe.
                },
            );
            console.log(
                chalk.green(
                    `   Successfully created Cloudflare Pages project: ${appTitle}`,
                ),
            );
        } catch (err) {
            console.log(
                chalk.yellow(
                    "   Wrangler command failed. You can create it manually.",
                ),
            );
        }
    } else {
        console.log(
            chalk.yellow(
                "   Wrangler CLI not found. Skipping automatic project creation.",
            ),
        );
    }

    // 7. Cleanup (Remove init.sh if it was downloaded)
    // Since we are creating a new folder via degit, we might accidentally pull init.sh
    // if it's in the repo. Let's delete it to be clean.
    const initScriptPath = path.join(targetDir, "init.sh");
    if (await fs.pathExists(initScriptPath)) {
        await fs.remove(initScriptPath);
    }

    // 8. Final Instructions (Replicating the "ACTION REQUIRED" block)
    console.log(chalk.green("\n--- Initialization Complete! ---\n"));
    console.log(chalk.yellow("!!! ACTION REQUIRED !!!"));
    console.log(
        "--------------------------------------------------------------------------",
    );
    console.log(
        "To enable deployments, you must configure your GitHub repository:\n",
    );

    console.log(`1. ${chalk.cyan("Create Cloudflare Pages Project:")}`);
    console.log(
        "   - Go to your Cloudflare dashboard and create a new Pages project.",
    );
    console.log("   - Choose the option to upload files directly.");
    console.log(
        "   - Once created you may exit the page, as the GitHub action will upload the files for you.\n",
    );

    console.log(`2. ${chalk.cyan("Set GitHub Repository Secrets:")}`);
    console.log(
        `   - In this repo, go to: ${chalk.green("Settings > Secrets and variables > Actions")}`,
    );
    console.log(
        `   - Click ${chalk.green("New repository secret")} and add the following:\n`,
    );

    console.log(`   - ${chalk.green("CLOUDFLARE_API_TOKEN")}`);
    console.log(
        "     (Create a token in Cloudflare with 'Edit Cloudflare Pages' permissions)\n",
    );

    console.log(`   - ${chalk.green("CLOUDFLARE_ACCOUNT_ID")}`);
    console.log("     (Find this on your main Cloudflare dashboard page)");
    console.log(
        "--------------------------------------------------------------------------\n",
    );

    console.log(`Next steps:`);
    console.log(`  cd ${projectDirName}`);
    console.log(`  npm install`);
    console.log(`  npm run dev\n`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
