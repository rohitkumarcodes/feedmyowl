"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { OwlOptionsShutter } from "@/features/settings/components/OwlOptionsShutter";
import { useMeasuredWidthPx } from "@/features/settings/components/useMeasuredWidthPx";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { saveOwlAscii } from "@/lib/client/settings";
import { OWL_ART_OPTIONS, coerceOwlAscii, type OwlAscii } from "@/lib/shared/owl-brand";
import styles from "../SettingsOverview.module.css";

interface OwlSectionProps {
  owlAscii: OwlAscii;
  controlsRef: RefObject<HTMLDivElement | null>;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}

export function OwlSection({
  owlAscii,
  controlsRef,
  isExpanded,
  setIsExpanded,
}: OwlSectionProps) {
  const router = useRouter();
  const owlOptionsPanelId = useId();
  const prefersReducedMotion = usePrefersReducedMotion();

  const owlWidthProbeRef = useRef<HTMLDivElement | null>(null);
  const owlControlsWidthPx = useMeasuredWidthPx(owlWidthProbeRef);

  const [draftOwlAscii, setDraftOwlAscii] = useState<OwlAscii>(owlAscii);
  const [savedOwlAscii, setSavedOwlAscii] = useState<OwlAscii>(owlAscii);
  const [isSavingOwl, setIsSavingOwl] = useState(false);
  const [owlSaveMessage, setOwlSaveMessage] = useState<string | null>(null);
  const [owlSaveError, setOwlSaveError] = useState<string | null>(null);

  const isOwlDirty = draftOwlAscii !== savedOwlAscii;

  useEffect(() => {
    setDraftOwlAscii(owlAscii);
    setSavedOwlAscii(owlAscii);
  }, [owlAscii]);

  function handleDraftOwlAsciiChange(nextOwlAscii: OwlAscii) {
    if (isSavingOwl || nextOwlAscii === draftOwlAscii) {
      return;
    }

    setDraftOwlAscii(nextOwlAscii);
    setOwlSaveError(null);
    setOwlSaveMessage(null);
  }

  async function handleSaveOwlAscii() {
    if (isSavingOwl || !isOwlDirty) {
      return;
    }

    setOwlSaveError(null);
    setOwlSaveMessage(null);
    setIsSavingOwl(true);

    const result = await saveOwlAscii({ owlAscii: draftOwlAscii });
    if (result.networkError) {
      setOwlSaveError("Could not connect to the server.");
      setIsSavingOwl(false);
      return;
    }

    if (!result.ok) {
      setOwlSaveError(result.body?.error || "Could not save owl selection.");
      setIsSavingOwl(false);
      return;
    }

    const persistedOwl = result.body?.owlAscii
      ? coerceOwlAscii(result.body.owlAscii)
      : draftOwlAscii;

    setDraftOwlAscii(persistedOwl);
    setSavedOwlAscii(persistedOwl);
    setOwlSaveMessage("Owl updated.");
    setIsSavingOwl(false);
    router.refresh();
  }

  return (
    <section className={styles.panel}>
      <h2>Hoot hoot</h2>
      <div ref={owlWidthProbeRef} className={styles.owlWidthProbe} aria-hidden="true">
        <button type="button" className={styles.owlToggle} tabIndex={-1}>
          <span className={styles.owlToggleCaret}>▸</span>
          <span className={styles.owlWidthProbeText}>
            Choose an owl to digest your feeds.
          </span>
        </button>
        <div className={styles.owlWidthProbeOptions}>
          {OWL_ART_OPTIONS.map((option) => (
            <label key={`probe-${option.ascii}`} className={styles.owlOption}>
              <input type="radio" name="owl-ascii-probe" tabIndex={-1} />
              <span className={styles.owlOptionAscii}>{option.ascii}</span>
              <span className={`${styles.owlOptionText} ${styles.owlWidthProbeText}`}>
                {option.name}:{" "}
                {option.emphasizeDescription ? (
                  <em className={styles.owlOptionEmphasis}>{option.description}</em>
                ) : (
                  option.description
                )}
              </span>
            </label>
          ))}
        </div>
      </div>
      <div
        ref={controlsRef}
        className={styles.owlPickerControls}
        style={owlControlsWidthPx ? { width: `${owlControlsWidthPx}px` } : undefined}
      >
        <button
          type="button"
          className={styles.owlToggle}
          aria-expanded={isExpanded}
          aria-controls={owlOptionsPanelId}
          onClick={() => {
            setIsExpanded(!isExpanded);
          }}
        >
          <span className={styles.owlToggleCaret}>{isExpanded ? "▾" : "▸"}</span>
          <span>Choose an owl to digest your feeds.</span>
        </button>
        <OwlOptionsShutter
          expanded={isExpanded}
          prefersReducedMotion={prefersReducedMotion}
          contentId={owlOptionsPanelId}
        >
          <div
            className={styles.owlOptionList}
            role="radiogroup"
            aria-label="Choose an owl to digest your feeds."
          >
            {OWL_ART_OPTIONS.map((option) => {
              const isSelected = draftOwlAscii === option.ascii;

              return (
                <label
                  key={option.ascii}
                  className={`${styles.owlOption} ${
                    isSelected ? styles.owlOptionSelected : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="owl-ascii"
                    value={option.ascii}
                    checked={isSelected}
                    disabled={isSavingOwl}
                    onChange={() => {
                      handleDraftOwlAsciiChange(option.ascii);
                    }}
                  />
                  <span className={styles.owlOptionAscii}>{option.ascii}</span>
                  <span className={styles.owlOptionText}>
                    {option.name}:{" "}
                    {option.emphasizeDescription ? (
                      <em className={styles.owlOptionEmphasis}>{option.description}</em>
                    ) : (
                      option.description
                    )}
                  </span>
                </label>
              );
            })}
          </div>
          <div className={styles.inlineActions}>
            <button
              type="button"
              className={styles.saveButton}
              onClick={() => {
                void handleSaveOwlAscii();
              }}
              disabled={isSavingOwl || !isOwlDirty}
            >
              Save
            </button>
          </div>
          {isSavingOwl ? (
            <p className={styles.inlineMessage} role="status">
              Saving owl...
            </p>
          ) : null}
          {owlSaveMessage ? (
            <p className={styles.inlineMessageSuccess} role="status">
              {owlSaveMessage}
            </p>
          ) : null}
          {owlSaveError ? (
            <p className={styles.inlineMessageError} role="alert" aria-live="assertive">
              {owlSaveError}
            </p>
          ) : null}
        </OwlOptionsShutter>
      </div>
    </section>
  );
}
