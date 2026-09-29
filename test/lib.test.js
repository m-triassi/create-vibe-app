import { test } from "node:test";
import assert from "node:assert/strict";
import {
    KEBAB_OR_SNAKE_CASE,
    applyReplacements,
    formatDefault,
    isBinary,
} from "../src/lib.js";

test("formatDefault humanizes a placeholder", () => {
    assert.equal(formatDefault(":author_name"), "Author Name");
    assert.equal(formatDefault(":application_title"), "Application Title");
});

test("isBinary detects known binary extensions", () => {
    assert.equal(isBinary("logo.png"), true);
    assert.equal(isBinary("nested/dir/icon.SVG"), true);
    assert.equal(isBinary("App.jsx"), false);
});

test("applyReplacements replaces all occurrences of every placeholder", () => {
    const result = applyReplacements(":application_title by :author_name", {
        ":application_title": "Vibe App",
        ":author_name": "Marc",
    });

    assert.equal(result, "Vibe App by Marc");
});

test("applyReplacements is a no-op when nothing matches", () => {
    const result = applyReplacements("nothing to replace here", {
        ":application_title": "Vibe App",
    });

    assert.equal(result, "nothing to replace here");
});

test("KEBAB_OR_SNAKE_CASE accepts kebab-case and snake_case names", () => {
    assert.equal(KEBAB_OR_SNAKE_CASE.test("my-vibe-app"), true);
    assert.equal(KEBAB_OR_SNAKE_CASE.test("my_vibe_app"), true);
    assert.equal(KEBAB_OR_SNAKE_CASE.test("My Vibe App"), false);
    assert.equal(KEBAB_OR_SNAKE_CASE.test("My_Vibe-App"), false);
});
