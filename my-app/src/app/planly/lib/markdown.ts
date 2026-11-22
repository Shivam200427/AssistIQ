/** Converts the HTML that TipTap produces into Markdown (for .md export). */
export function htmlToMarkdown(html: string): string {
  if (typeof window === "undefined" || !html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");

  const inline = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
    if (!(node instanceof HTMLElement)) return "";
    const inner = [...node.childNodes].map(inline).join("");
    switch (node.tagName) {
      case "STRONG":
      case "B":
        return inner ? `**${inner}**` : "";
      case "EM":
      case "I":
        return inner ? `*${inner}*` : "";
      case "S":
        return inner ? `~~${inner}~~` : "";
      case "CODE":
        return `\`${inner}\``;
      case "A":
        return `[${inner}](${node.getAttribute("href") || ""})`;
      case "BR":
        return "  \n";
      default:
        return inner;
    }
  };

  const block = (node: Node, depth = 0): string => {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent || "").trim() ? node.textContent! : "";
    if (!(node instanceof HTMLElement)) return "";
    const indent = "  ".repeat(depth);
    switch (node.tagName) {
      case "H1":
      case "H2":
      case "H3":
      case "H4":
        return `${"#".repeat(Number(node.tagName[1]))} ${inline(node)}\n\n`;
      case "P":
        return `${inline(node)}\n\n`;
      case "BLOCKQUOTE":
        return (
          [...node.childNodes]
            .map((c) => block(c, depth))
            .join("")
            .trim()
            .split("\n")
            .map((l) => `> ${l}`)
            .join("\n") + "\n\n"
        );
      case "PRE":
        return `\`\`\`\n${node.textContent || ""}\n\`\`\`\n\n`;
      case "HR":
        return "---\n\n";
      case "UL":
      case "OL": {
        const isTask = node.getAttribute("data-type") === "taskList";
        const items = [...node.children].map((li, i) => {
          const checked = li.getAttribute("data-checked") === "true";
          const marker = isTask ? `- [${checked ? "x" : " "}]` : node.tagName === "OL" ? `${i + 1}.` : "-";
          const parts = [...li.childNodes].filter((c) => !(c instanceof HTMLElement && c.tagName === "LABEL"));
          const text = parts
            .filter((c) => !(c instanceof HTMLElement && (c.tagName === "UL" || c.tagName === "OL")))
            .map((c) => (c instanceof HTMLElement && c.tagName === "DIV" ? [...c.childNodes].map(inline).join("") : inline(c)))
            .join("")
            .trim();
          const nested = parts
            .filter((c) => c instanceof HTMLElement && (c.tagName === "UL" || c.tagName === "OL"))
            .map((c) => block(c, depth + 1))
            .join("");
          const nestedInDiv = parts
            .filter((c) => c instanceof HTMLElement && c.tagName === "DIV")
            .flatMap((c) => [...(c as HTMLElement).children].filter((x) => x.tagName === "UL" || x.tagName === "OL"))
            .map((c) => block(c, depth + 1))
            .join("");
          return `${indent}${marker} ${text}\n${nested}${nestedInDiv}`;
        });
        return items.join("") + (depth === 0 ? "\n" : "");
      }
      default:
        return [...node.childNodes].map((c) => block(c, depth)).join("");
    }
  };

  return [...doc.body.childNodes].map((n) => block(n)).join("").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function htmlToText(html: string): string {
  if (typeof window === "undefined" || !html) return "";
  // Add a space after each block so "Heading</h1><p>Text" doesn't read as "HeadingText".
  const spaced = html.replace(/<\/(p|h[1-6]|li|div|blockquote|pre)>/gi, "$& ");
  return (new DOMParser().parseFromString(spaced, "text/html").body.textContent || "").replace(/\s+/g, " ").trim();
}
