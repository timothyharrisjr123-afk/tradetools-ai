/**
 * Company Settings Payments connection presentation — loading must never
 * masquerade as disconnected.
 *
 * Run: npx tsx --test app/tools/settings/CompanySettingsPaymentsEditor.test.ts
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  resolvePaymentsConnectionView,
  stripeConnectionLabel,
} from "@/app/tools/settings/CompanySettingsPaymentsEditor";
import { summarizePayments } from "@/app/lib/companySettingsSummary";
import type { CompanyPaymentsStatus } from "@/app/tools/settings/companySettingsData";
import { readFileSync } from "node:fs";
import path from "node:path";

const CONNECTED: CompanyPaymentsStatus = {
  connected: true,
  chargesEnabled: true,
  detailsSubmitted: true,
  defaultDepositMode: "none",
  defaultDepositPercentBps: null,
  defaultDepositFixedCents: null,
};

const DISCONNECTED: CompanyPaymentsStatus = {
  connected: false,
  chargesEnabled: false,
  detailsSubmitted: false,
  defaultDepositMode: "none",
  defaultDepositPercentBps: null,
  defaultDepositFixedCents: null,
};

const INCOMPLETE: CompanyPaymentsStatus = {
  connected: true,
  chargesEnabled: false,
  detailsSubmitted: true,
  defaultDepositMode: "none",
  defaultDepositPercentBps: null,
  defaultDepositFixedCents: null,
};

describe("Payments connection load truth", () => {
  test("loading does not render Not connected or Connect Stripe affordance kinds", () => {
    const view = resolvePaymentsConnectionView(null, "loading");
    assert.equal(view.kind, "loading");
    assert.equal(view.label, "Checking…");
    assert.notEqual(view.label, "Not connected");
    assert.equal(stripeConnectionLabel(null, "loading"), "Checking…");
    assert.equal(summarizePayments(null, "loading"), "Checking…");
  });

  test("error does not masquerade as disconnected", () => {
    const view = resolvePaymentsConnectionView(null, "error");
    assert.equal(view.kind, "error");
    assert.equal(view.label, "Couldn't load status");
    assert.notEqual(view.label, "Not connected");
    assert.equal(summarizePayments(null, "error"), "Couldn't load status");
  });

  test("canonical disconnected shows Not connected", () => {
    const view = resolvePaymentsConnectionView(DISCONNECTED, "ready");
    assert.equal(view.kind, "not_connected");
    assert.equal(view.label, "Not connected");
    assert.match(summarizePayments(DISCONNECTED, "ready"), /not connected/i);
  });

  test("canonical connected shows Connected", () => {
    const view = resolvePaymentsConnectionView(CONNECTED, "ready");
    assert.equal(view.kind, "connected");
    assert.equal(view.label, "Connected");
    assert.equal(summarizePayments(CONNECTED, "ready"), "Stripe connected");
  });

  test("setup incomplete stays distinct from not connected", () => {
    const view = resolvePaymentsConnectionView(INCOMPLETE, "ready");
    assert.equal(view.kind, "setup_incomplete");
    assert.match(view.label, /Finish|Setup/i);
  });

  test("Payments editor withholds Connect Stripe until load is ready", () => {
    const source = readFileSync(
      path.join(process.cwd(), "app/tools/settings/CompanySettingsPaymentsEditor.tsx"),
      "utf8"
    );
    assert.match(source, /showConnectAction/);
    assert.match(source, /loadStatus === "ready"/);
    assert.match(source, /data-payments-connection-kind/);
    assert.doesNotMatch(
      source,
      /if \(!status\?\.connected\) return "Not connected"/
    );
  });

  test("CompanySettingsClient tracks paymentsStatus load gate", () => {
    const source = readFileSync(
      path.join(process.cwd(), "app/tools/settings/CompanySettingsClient.tsx"),
      "utf8"
    );
    assert.match(source, /paymentsStatus/);
    assert.match(source, /summarizePayments\(payments, paymentsStatus\)/);
    assert.match(source, /loadStatus=\{paymentsStatus\}/);
  });
});
