import path from "path";
import { spawnSync } from "child_process";

export const BINARY_EXTENSIONS = new Set([
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

export const KEBAB_OR_SNAKE_CASE = /^[a-z0-9]+([-_][a-z0-9]+)*$/;

export const formatDefault = (placeholder) =>
    placeholder
        .replace(/^:/, "")
        .split("_")
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join(" ");

export const isBinary = (filePath) =>
    BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase());

export const commandExists = (command) =>
    spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;

export const applyReplacements = (value, replacements) =>
    Object.entries(replacements).reduce(
        (result, [from, to]) => result.replaceAll(from, to),
        value,
    );

export function run(command, args, cwd) {
    const { status, error } = spawnSync(command, args, { cwd, stdio: "inherit" });
    if (error || status) throw error || new Error(`${command} exited with code ${status}`);
}
