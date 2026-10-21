import assert from "node:assert/strict";
import test from "node:test";
import messages from "../emails/dist/messages.json";
import { fillTemplate, type EmailTemplate } from "../src/lib/api/email-template";

const sample: EmailTemplate = {
  subject: "Hello {{name}}",
  html: "<p>{{name}}</p>",
  text: "Hello {{name}}",
  variables: ["name"],
};

const codeLine = /Use this code to (?:reset your VolunTime password|accept the invite):\s*([A-Za-z0-9_-]+)/;

test("encodes html values and leaves plain text raw", () => {
  const filled = fillTemplate(sample, { name: `A<B> & "C"` });
  assert.equal(filled.html, `<p>A&lt;B&gt; &amp; &quot;C&quot;</p>`);
  assert.equal(filled.text, `Hello A<B> & "C"`);
});

test("does not expand placeholders introduced by a value", () => {
  const filled = fillTemplate(sample, { name: "{{name}}" });
  assert.equal(filled.text, "Hello {{name}}");
});

test("strips line breaks from the subject", () => {
  const filled = fillTemplate(sample, { name: "Acme\r\nNorth" });
  assert.equal(filled.subject, "Hello Acme North");
  assert.equal(filled.text, "Hello Acme\r\nNorth");
});

test("throws when a variable is missing", () => {
  assert.throws(() => fillTemplate(sample, {}), /Missing email variable name/);
});

test("rendered templates keep the mailed code lines", () => {
  const resetUrl = "https://clocked.example/forgot-password?code=abc_123";
  const reset = fillTemplate(messages["password-reset"], { code: "abc_123", url: resetUrl });
  assert.equal(codeLine.exec(reset.text)?.[1], "abc_123");
  assert.match(reset.html, /abc_123/);
  assert.match(reset.text, /https:\/\/clocked\.example\/forgot-password\?code=abc_123/);
  assert.match(reset.html, /https:\/\/clocked\.example\/forgot-password\?code=abc_123/);
  assert.equal(reset.subject, "Your VolunTime password reset code");

  const inviteUrl = "https://clocked.example/accept?code=invite-9";
  const invite = fillTemplate(messages.invitation, {
    targetName: "North <Org>",
    roleName: "Member",
    code: "invite-9",
    url: inviteUrl,
  });
  assert.equal(codeLine.exec(invite.text)?.[1], "invite-9");
  assert.match(invite.html, /North &lt;Org&gt;/);
  assert.match(invite.text, /North <Org>/);
  assert.match(invite.text, /https:\/\/clocked\.example\/accept\?code=invite-9/);
  assert.match(invite.html, /https:\/\/clocked\.example\/accept\?code=invite-9/);
  assert.equal(invite.subject, "You are invited to North <Org>");
});
