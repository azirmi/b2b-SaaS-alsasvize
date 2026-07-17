"use client";

import { Button } from "@/components/ui/button";

interface FormPrintButtonProps {
  targetId: string;
  label?: string;
}

export function FormPrintButton({
  targetId,
  label = "Yazdır",
}: FormPrintButtonProps) {
  function handlePrint() {
    const target = document.getElementById(targetId);
    if (!target) {
      return;
    }

    const printWindow = window.open(
      "",
      "_blank",
      "noopener,noreferrer,width=980,height=760",
    );
    if (!printWindow) {
      return;
    }

    const styles = Array.from(
      document.querySelectorAll("style, link[rel='stylesheet']"),
    )
      .map((node) => node.outerHTML)
      .join("\n");

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${label}</title>
    ${styles}
    <style>
      body {
        margin: 24px;
        color: #0f172a;
      }
    </style>
  </head>
  <body>
    ${target.outerHTML}
  </body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
      {label}
    </Button>
  );
}
