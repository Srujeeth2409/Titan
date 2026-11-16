"use client"

import RidgelineDitherFooter from "@/components/ui/ridgeline-dither-footer"

export default function DemoGlacier() {
  return (
    <div className="w-full">
      <RidgelineDitherFooter
        preset="glacier"
        seed={23}
        ridges={7}
        name="Titan"
        tagline="Enterprise AI teammate for multi-source knowledge retrieval, hybrid search, claim citation verification, and hallucination scoring."
        columns={[
          {
            title: "Platform",
            links: [
              { label: "Hybrid Search" },
              { label: "Citation Verification", badge: "Live" },
              { label: "Hallucination Scoring" },
              { label: "Multi-Query Engine" },
            ],
          },
          {
            title: "Solutions",
            links: [
              { label: "Enterprise RAG" },
              { label: "Document Processing" },
              { label: "Security & Governance" },
            ],
          },
          {
            title: "Company",
            links: [
              { label: "About Titan" },
              { label: "Careers", badge: "Hiring" },
              { label: "Security" },
            ],
          },
        ]}
        socials={[
          { icon: "github", href: "https://github.com" },
          { icon: "linkedin", href: "https://linkedin.com" },
          { icon: "x", href: "https://x.com" },
        ]}
        credit={{ label: "Titan Core Team", href: "#" }}
      />
    </div>
  )
}
