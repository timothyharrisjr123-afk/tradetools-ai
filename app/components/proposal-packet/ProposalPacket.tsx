"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { formatUsdFromCents } from "@/app/lib/jobPaymentMoney";
import type { ProposalCustomerPacketViewModel } from "@/app/lib/proposalCustomerPacketViewModel";
import {
  proposalCustomerAmountLabel,
  PROPOSAL_CUSTOMER_PACKET_CHOICE_SAVE_ERROR,
} from "@/app/lib/proposalCustomerPacketViewModel";
import {
  resolveDepositObligationCents,
  termsRequireOnlineDeposit,
} from "@/app/lib/proposalPaymentTerms";
import ProposalPacketComparison from "./ProposalPacketComparison";
import ProposalPacketDetailsContact from "./ProposalPacketDetailsContact";
import ProposalPacketFooter from "./ProposalPacketFooter";
import ProposalPacketHero from "./ProposalPacketHero";
import ProposalPacketPurchase from "./ProposalPacketPurchase";
import ProposalPacketScope from "./ProposalPacketScope";
import ProposalPacketStickyPurchaseBar from "./ProposalPacketStickyPurchaseBar";
import ProposalPacketTopBar from "./ProposalPacketTopBar";
import ProposalPacketUpgrades from "./ProposalPacketUpgrades";
import {
  PROPOSAL_PACKET_PAGE,
  PROPOSAL_PACKET_SHELL,
  PROPOSAL_PACKET_STORY_SECTION,
  PROPOSAL_PACKET_STORY_SECTION_MUTED,
} from "./proposalPacketStyles";
import { useProposalPurchaseAction } from "./useProposalPurchaseAction";

export type ProposalPacketMode = "public" | "preview";

type ProposalPacketProps = {
  packet: ProposalCustomerPacketViewModel;
  mode?: ProposalPacketMode;
  /** Raw public access token from /p/[token] — enables durable public actions. */
  publicAccessToken?: string | null;
};

/**
 * FieldDive customer proposal — a buying decision, not a status page.
 *
 * brand → project context → choose a package if more than one is offered →
 * one purchase composition (package, price, terms, due today, one action) →
 * included work → included upgrades → warranty/notes/terms → questions → footer.
 *
 * The decision sits immediately after the options so money is never separated
 * from the choice by unrelated sections.
 */
export default function ProposalPacket({
  packet,
  mode = "public",
  publicAccessToken = null,
}: ProposalPacketProps) {
  const options = useMemo(() => packet.comparison?.options ?? [], [packet.comparison]);
  const showChoice = options.length > 1;
  const showUpgrades = packet.upgrades != null && packet.upgrades.items.length > 0;
  const showIncludedScope =
    packet.estimate != null &&
    (packet.estimate.scopeGroupSummaries.length > 0 ||
      packet.estimate.includedDetails.length > 0);
  const requestToken = mode === "public" ? publicAccessToken : null;
  const terms = packet.paymentTerms ?? null;
  const requiresDeposit = terms ? termsRequireOnlineDeposit(terms) : false;

  const initialStatus = packet.acceptance?.status ?? "open";
  const [accepted, setAccepted] = useState(
    initialStatus === "accepted" || initialStatus === "signed"
  );
  const [acceptedOnLabel] = useState(packet.acceptance?.acceptedOnLabel ?? null);

  // Hydrated from server truth: accepted choice, else durable provisional
  // choice, else the contractor's frozen current/default. The UI is not canonical.
  const defaultKey =
    options.find((option) => option.isCurrent)?.optionKey ??
    packet.estimate?.optionKey ??
    options[0]?.optionKey ??
    null;
  const [chosenKey, setChosenKey] = useState<string | null>(defaultKey);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [choiceError, setChoiceError] = useState<string | null>(null);

  const chosenOption = useMemo(
    () => options.find((option) => option.optionKey === chosenKey) ?? null,
    [chosenKey, options]
  );

  // Fall back to the contractor's frozen estimate for single-offer proposals.
  const packageLabel = chosenOption?.label ?? packet.estimate?.label ?? "Your package";
  const packageDescription = chosenOption?.description ?? packet.estimate?.description ?? null;
  const packageTotalLabel =
    chosenOption?.totalInvestmentLabel ?? packet.estimate?.totalInvestmentLabel ?? null;
  const packageTotalCents =
    chosenOption?.totalCents ?? packet.selectedTotalCents ?? null;
  const differentiators = chosenOption?.bullets ?? packet.estimate?.bullets ?? [];

  const onConfirmed = () => {
    setAccepted(true);
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  const persistChoice = useCallback(
    (optionKey: string) => {
      if (!requestToken || accepted || pendingKey) return;
      if (optionKey === chosenKey) return;
      const previous = chosenKey;
      setChoiceError(null);
      setChosenKey(optionKey);
      setPendingKey(optionKey);

      void (async () => {
        try {
          const response = await fetch("/api/proposals/public-option-choice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: requestToken, optionKey }),
          });
          const data = (await response.json().catch(() => null)) as
            | { ok?: boolean; optionKey?: string }
            | null;
          if (!response.ok || data?.ok !== true) {
            setChosenKey(previous);
            setChoiceError(PROPOSAL_CUSTOMER_PACKET_CHOICE_SAVE_ERROR);
            return;
          }
          setChosenKey(typeof data.optionKey === "string" ? data.optionKey : optionKey);
        } catch {
          setChosenKey(previous);
          setChoiceError(PROPOSAL_CUSTOMER_PACKET_CHOICE_SAVE_ERROR);
        } finally {
          setPendingKey(null);
        }
      })();
    },
    [accepted, chosenKey, pendingKey, requestToken]
  );

  // Send the chosen key only when the customer actually had a choice to make.
  const action = useProposalPurchaseAction({
    terms,
    payment: packet.payment ?? null,
    publicAccessToken: requestToken,
    chosenOptionKey: showChoice ? chosenKey : null,
    accepted,
    onConfirmed,
  });

  const purchaseAction = {
    ...action,
    busy: action.busy || pendingKey != null,
    submit: () => {
      if (pendingKey) return;
      action.submit();
    },
  };

  const purchaseRef = useRef<HTMLElement | null>(null);

  const stickyDueLabel = proposalCustomerAmountLabel(
    requiresDeposit && !accepted && terms && packageTotalCents != null
      ? (() => {
          const cents = resolveDepositObligationCents({
            mode: terms.depositMode,
            percentBps: terms.depositPercentBps,
            fixedCents: terms.depositFixedCents,
            acceptedTotalCents: packageTotalCents,
          });
          return cents > 0 ? formatUsdFromCents(cents) : packet.payment?.amountLabel;
        })()
      : packet.payment?.amountLabel
  );

  const showPurchase = terms != null || packet.payment != null || packet.estimate != null;

  return (
    <main className={PROPOSAL_PACKET_PAGE} data-proposal-packet-mode={mode}>
      <article className={PROPOSAL_PACKET_SHELL} aria-label="Customer proposal">
        <ProposalPacketTopBar cover={packet.cover} />
        <ProposalPacketHero cover={packet.cover} estimate={packet.estimate} />

        {showChoice ? (
          <section className={PROPOSAL_PACKET_STORY_SECTION} aria-label="Choose your package">
            <ProposalPacketComparison
              comparison={packet.comparison!}
              chosenOptionKey={chosenKey}
              onChoose={mode === "public" ? persistChoice : undefined}
              locked={accepted}
              pending={pendingKey != null}
            />
            {choiceError ? (
              <p className="mt-3 text-[13px] text-[#b45309]" role="alert">
                {choiceError}
              </p>
            ) : null}
          </section>
        ) : null}

        {showPurchase ? (
          <section
            ref={purchaseRef}
            className={PROPOSAL_PACKET_STORY_SECTION}
            aria-label="Your package and payment"
          >
            <ProposalPacketPurchase
              packageLabel={packageLabel}
              packageDescription={packageDescription}
              packageTotalLabel={packageTotalLabel}
              packageTotalCents={packageTotalCents}
              differentiators={differentiators}
              terms={terms}
              payment={packet.payment ?? null}
              accepted={accepted}
              acceptedOnLabel={acceptedOnLabel}
              action={purchaseAction}
            />
          </section>
        ) : null}

        {showIncludedScope && packet.estimate ? (
          <section
            className={showChoice ? PROPOSAL_PACKET_STORY_SECTION_MUTED : PROPOSAL_PACKET_STORY_SECTION}
            aria-label="Included work"
          >
            <ProposalPacketScope estimate={packet.estimate} />
          </section>
        ) : null}

        {showUpgrades ? (
          <section className={PROPOSAL_PACKET_STORY_SECTION} aria-label="Included upgrades">
            <ProposalPacketUpgrades upgrades={packet.upgrades!} />
          </section>
        ) : null}

        <ProposalPacketDetailsContact
          details={packet.details}
          contact={packet.contact}
          mode={mode}
        />

        <ProposalPacketFooter contact={packet.contact} footerMetadata={packet.footerMetadata} />
      </article>

      {mode === "public" ? (
        <ProposalPacketStickyPurchaseBar
          watchRef={purchaseRef}
          dueLabel={stickyDueLabel}
          action={purchaseAction}
        />
      ) : null}
    </main>
  );
}
