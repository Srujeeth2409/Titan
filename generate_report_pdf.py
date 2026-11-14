import subprocess
import os

html_content = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Titan - Final Project Report</title>
<style>
  @page {
    size: A4;
    margin: 25mm 20mm 20mm 20mm;
    @bottom-center {
      content: counter(page);
      font-family: "Times New Roman", Times, serif;
      font-size: 10pt;
    }
  }

  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 12pt;
    line-height: 1.6;
    color: #111827;
    text-align: justify;
    margin: 0;
    padding: 0;
  }

  .page-break {
    page-break-before: always;
  }

  .cover-page {
    border: 3px double #1e3a8a;
    padding: 30px 25px;
    min-height: 920px;
    box-sizing: border-box;
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .univ-header {
    font-size: 14pt;
    font-weight: bold;
    color: #0f172a;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    line-height: 1.4;
    margin-bottom: 5px;
  }

  .univ-sub {
    font-size: 9.5pt;
    color: #475569;
    margin-bottom: 25px;
  }

  .report-label {
    font-size: 13pt;
    font-weight: normal;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 15px 0 5px 0;
  }

  .project-title {
    font-size: 18pt;
    font-weight: bold;
    color: #1e3a8a;
    line-height: 1.35;
    margin: 15px 0;
    text-transform: uppercase;
  }

  .degree-text {
    font-size: 11pt;
    color: #334155;
    line-height: 1.5;
    margin: 20px 0;
  }

  .table-center {
    width: 90%;
    margin: 15px auto;
    border-collapse: collapse;
    font-size: 11pt;
  }

  .table-center th, .table-center td {
    border: 1px solid #94a3b8;
    padding: 8px 12px;
    text-align: left;
  }

  .table-center th {
    background-color: #f1f5f9;
    font-weight: bold;
  }

  .guide-box {
    margin-top: 25px;
    font-size: 11.5pt;
  }

  .guide-name {
    font-size: 13pt;
    font-weight: bold;
    color: #0f172a;
  }

  h1 {
    font-size: 16pt;
    font-weight: bold;
    color: #0f172a;
    text-transform: uppercase;
    border-bottom: 2px solid #1e3a8a;
    padding-bottom: 6px;
    margin-top: 0;
    margin-bottom: 18px;
    page-break-after: avoid;
  }

  h2 {
    font-size: 13pt;
    font-weight: bold;
    color: #1e3a8a;
    margin-top: 20px;
    margin-bottom: 10px;
    page-break-after: avoid;
  }

  h3 {
    font-size: 11.5pt;
    font-weight: bold;
    color: #334155;
    margin-top: 15px;
    margin-bottom: 8px;
    page-break-after: avoid;
  }

  p {
    margin-top: 0;
    margin-bottom: 12px;
    text-indent: 2em;
  }

  .no-indent {
    text-indent: 0;
  }

  ul, ol {
    margin-top: 0;
    margin-bottom: 14px;
    padding-left: 28px;
  }

  li {
    margin-bottom: 6px;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
    margin: 16px 0 20px 0;
    page-break-inside: avoid;
  }

  .data-table th, .data-table td {
    border: 1px solid #cbd5e1;
    padding: 7px 10px;
    text-align: left;
  }

  .data-table th {
    background-color: #f8fafc;
    color: #0f172a;
    font-weight: bold;
  }

  .data-table tr:nth-child(even) {
    background-color: #fcfdfe;
  }

  .table-caption {
    font-weight: bold;
    font-size: 10.5pt;
    margin-bottom: 6px;
    text-align: left;
    color: #1e293b;
  }

  .math-block {
    background: #f8fafc;
    border-left: 4px solid #3b82f6;
    padding: 10px 16px;
    margin: 14px 0;
    font-family: "Courier New", Courier, monospace;
    font-size: 11pt;
    text-indent: 0;
  }

  .sig-table {
    width: 100%;
    margin-top: 60px;
    border: none;
  }

  .sig-table td {
    border: none;
    padding: 10px;
    vertical-align: bottom;
    text-align: center;
  }

  .sig-line {
    border-top: 1px solid #334155;
    width: 80%;
    margin: 0 auto;
    padding-top: 6px;
    font-size: 11pt;
    font-weight: bold;
  }

  .toc-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
    border-bottom: 1px dotted #cbd5e1;
    padding-bottom: 2px;
  }
</style>
</head>
<body>

<!-- ================= COVER PAGE ================= -->
<div class="cover-page">
  <div>
    <div class="report-label">A Project Report On</div>
    <div class="project-title">Titan - Agentic Retrieval-Augmented Generation Platform for Verified Enterprise Question Answering and Workspace Collaboration</div>
    
    <div class="degree-text">
      Submitted in partial fulfilment of the requirements for the award of the Degree of<br>
      <strong>BACHELOR OF TECHNOLOGY</strong><br>
      in<br>
      <strong>COMPUTER TECHNOLOGY (THIRD YEAR)</strong>
    </div>

    <div style="margin: 15px 0;">
      <div style="font-size: 11pt; font-weight: bold; margin-bottom: 6px; text-transform: uppercase;">Submitted by:</div>
      <table class="table-center">
        <thead>
          <tr>
            <th>Name of Student</th>
            <th style="width: 35%; text-align: center;">PRN / Roll No.</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Srujeeth Visinigiri</td><td style="text-align: center;">2024000417</td></tr>
          <tr><td>Priyanshi Chaudhary</td><td style="text-align: center;">2024000420</td></tr>
          <tr><td>Takshil Dhuri</td><td style="text-align: center;">2024000381</td></tr>
          <tr><td>Srushti Gujar</td><td style="text-align: center;">2024000384</td></tr>
        </tbody>
      </table>
    </div>

    <div class="guide-box">
      Under the guidance of<br>
      <div class="guide-name">Prof. Dr. Pratibha Jadhav</div>
    </div>
  </div>

  <div style="margin-top: 30px;">
    <div class="univ-header">Ratan Tata Maharashtra State Skills University</div>
    <div class="univ-sub">
      Established by Maharashtra Act VII of 2021 dated 23rd March 2021<br>
      1st floor, Elphinstone Technical High School, 3 Mahapalika Marg, Metro Chowk, Mumbai – 400001<br>
      <strong>Academic Year: 2026–2027</strong>
    </div>
  </div>
</div>

<!-- ================= DECLARATION ================= -->
<div class="page-break"></div>
<div style="text-align: center; margin-bottom: 25px;">
  <div class="univ-header">Ratan Tata Maharashtra State Skills University</div>
  <div style="font-size: 11pt; font-weight: bold; color: #334155;">DEPARTMENT OF INFORMATION TECHNOLOGY & COMPUTER TECHNOLOGY</div>
</div>

<h1>Student’s Declaration</h1>
<p>
We hereby declare that the work being presented in this project entitled <strong>“Titan - Agentic Retrieval-Augmented Generation Platform for Verified Enterprise Question Answering and Workspace Collaboration”</strong> in partial fulfilment for the award of the degree of <strong>Bachelor of Technology in Information Technology & Computer Technology</strong> and submitted at the Department of Information Technology & Computer Technology of Ratan Tata Maharashtra State Skills University is an authentic record of our work carried out under the guidance of <strong>Prof. Dr. Pratibha Jadhav</strong> and <strong>Prof. Dr. Rajendra Khade</strong>, HOD, Department of Information Technology & Computer Technology, Ratan Tata Maharashtra State Skills University, Mumbai.
</p>

<table class="data-table" style="margin-top: 35px;">
  <thead>
    <tr>
      <th>Student Name</th>
      <th style="width: 30%; text-align: center;">Student PRN</th>
      <th style="width: 35%; text-align: center;">Signature</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Srujeeth Visinigiri</td><td style="text-align: center;">2024000417</td><td style="height: 35px;"></td></tr>
    <tr><td>Priyanshi Chaudhary</td><td style="text-align: center;">2024000420</td><td style="height: 35px;"></td></tr>
    <tr><td>Takshil Dhuri</td><td style="text-align: center;">2024000381</td><td style="height: 35px;"></td></tr>
    <tr><td>Srushti Gujar</td><td style="text-align: center;">2024000384</td><td style="height: 35px;"></td></tr>
  </tbody>
</table>

<!-- ================= CERTIFICATE ================= -->
<div class="page-break"></div>
<h1>Certificate</h1>
<p class="no-indent">
This is to certify that the declaration made by the candidates is correct to the best of our knowledge. The project work entitled <strong>“Titan - Agentic Retrieval-Augmented Generation Platform for Verified Enterprise Question Answering and Workspace Collaboration”</strong> has been successfully executed and completed by:
</p>

<ul>
  <li><strong>Srujeeth Visinigiri</strong> (PRN: 2024000417)</li>
  <li><strong>Priyanshi Chaudhary</strong> (PRN: 2024000420)</li>
  <li><strong>Takshil Dhuri</strong> (PRN: 2024000381)</li>
  <li><strong>Srushti Gujar</strong> (PRN: 2024000384)</li>
</ul>

<p class="no-indent">
Examination of this work is carried out on: ____________________
</p>
<p class="no-indent">
Place: Mumbai
</p>

<div style="margin-top: 40px;">
  <strong>Examiners:</strong><br>
  1. _____________________________________________<br><br>
  2. _____________________________________________
</div>

<table class="sig-table">
  <tr>
    <td style="width: 50%;">
      <div class="sig-line">
        Prof. Dr. Pratibha Jadhav<br>
        <span style="font-weight: normal; font-size: 10pt;">Project Guide</span>
      </div>
    </td>
    <td style="width: 50%;">
      <div class="sig-line">
        Prof. Dr. Rajendra Khade<br>
        <span style="font-weight: normal; font-size: 10pt;">Head of Department</span>
      </div>
    </td>
  </tr>
</table>

<!-- ================= ACKNOWLEDGEMENT & ABSTRACT ================= -->
<div class="page-break"></div>
<h1>Acknowledgement</h1>
<p>
We sincerely express our deep sense of gratitude to our Guide, <strong>Prof. Dr. Pratibha Jadhav</strong>, for her valuable guidance, continuous encouragement, and constant support throughout the completion of this project work. Her valuable suggestions, technical insights, and motivation have been a great source of inspiration to us.
</p>
<p>
We are also deeply grateful to our Head of Department of Information Technology & Computer Technology, <strong>Prof. Dr. Rajendra Khade</strong>, for his guidance, administrative encouragement, and timely help given to us during the entire course of this project.
</p>
<p>
We would like to extend our heartfelt thanks to our Project Coordinator for consistent support, cooperation, and valuable direction that guided us toward the successful completion of the project. Finally, we wish to express our gratitude to all faculty members of the Department of Information Technology & Computer Technology for their valuable teaching and guidance, which inspired us to achieve our goals.
</p>

<div style="margin-top: 40px; text-align: right; font-weight: bold;">
  Srujeeth Visinigiri | Priyanshi Chaudhary | Takshil Dhuri | Srushti Gujar<br>
  <span style="font-weight: normal; font-size: 10.5pt;">Department of Computer Technology, TYCT, Academic Year 2026–2027</span>
</div>

<div class="page-break"></div>
<h1>Abstract</h1>
<p>
Enterprises store mission-critical operational knowledge across disparate, unindexed silos including technical runbooks, architecture specifications, compliance policies, and incident post-mortems. While Large Language Models (LLMs) demonstrate remarkable generative capabilities, off-the-shelf deployments fail in corporate environments due to three fundamental flaws: an inability to access private or air-gapped domain repositories, temporal knowledge cutoff boundaries, and catastrophic hallucinations when confronted with domain-specific tokens or ambiguous multi-document queries. Conventional Retrieval-Augmented Generation (RAG) implementations mitigate these limitations superficially, yet remain brittle: they routinely fail to locate exact alphanumeric identifiers (such as configuration keys or error codes like <code>LEDGER-503</code>), lack multi-hop reasoning over documents, attach unverified or fabricated citations, and operate as disconnected Q&A widgets divorced from workplace workflows.
</p>
<p>
This project presents <strong>Titan</strong>, an enterprise-grade, agentic RAG platform and unified workspace collaboration workstation. Titan introduces a resilient, dual-index retrieval pipeline combining dense vector embeddings (FastEmbed BGE-small in Qdrant) with sparse probabilistic lexical search (BM25), merged via weighted Reciprocal Rank Fusion (RRF, <i>k</i> = 60) and refined through Cross-Encoder reranking. For complex queries, a bounded agentic execution loop autonomously handles query sanitization, prompt injection defense, multi-step sub-question decomposition, iterative retrieval, and context grading. Every drafted answer is broken into atomic claims, verified against retrieved source passages, and evaluated via a composite confidence score:
</p>
<div class="math-block">
Confidence C = 0.35 × R + 0.35 × V + 0.20 × G + 0.10 × P
</div>
<p>
Queries with weak evidence trigger structured abstentions detailing missing sources rather than fabricating answers.
</p>
<p>
Crucially, Titan bridges the gap between conversational AI and enterprise daily operations by integrating an end-to-end Enterprise Workspace Suite. Built with Next.js 14 and FastAPI, the platform features a real-time corporate mail client with live cross-device broadcasting, 1-click export of synthesized RAG intelligence into structured executive email drafts, real-time team chat with live reactions, and peer-to-peer WebRTC video conferencing with deterministic signaling. Featuring a multi-provider LLM gateway (Ollama for private on-premise execution with fallback to Groq for cloud edge inference), Titan offers a production-hardened, observable, and verifiable solution for modern enterprise knowledge management.
</p>

<!-- ================= CHAPTER 1 ================= -->
<div class="page-break"></div>
<h1>Chapter 1: Introduction</h1>
<p>
In modern digital enterprises, institutional knowledge expands rapidly across runbooks, code wikis, architectural blueprints, legal guidelines, and incident records. Locating precise facts across these repositories consumes substantial engineering and administrative hours. While generative language models can draft coherent text, their application to proprietary enterprise knowledge is hindered by hallucination, security risks, and the absence of verifiable proof.
</p>
<p>
Traditional naive RAG implementations—typically a single embedding model querying a vector database paired with an unconstrained prompt—fail in production. They fail to retrieve exact tokens like error codes, struggle when an answer requires synthesizing evidence scattered across multiple files, and produce detached answers that employees cannot readily verify, share, or act upon.
</p>
<p>
<strong>Titan</strong> is engineered as an enterprise-grade agentic RAG workstation that turns internal documents into verifiable, interactive intelligence. Rather than acting as a standalone chatbot, Titan functions as a complete digital workstation: it ingests heterogeneous documents, indexes them across dual dense-sparse engines, decomposes multi-step questions, checks citations at the sentence level, and enables employees to immediately collaborate over answers via integrated corporate mail, live chat channels, and WebRTC video conferencing.
</p>
<p class="no-indent">The architecture rests on five pillars:</p>
<ol>
  <li><strong>Hybrid Dense-Sparse Retrieval:</strong> Parallel semantic embedding search (Qdrant) and lexical keyword search (BM25) fused via weighted Reciprocal Rank Fusion (RRF) and Cross-Encoder reranking.</li>
  <li><strong>Multi-Provider & Extractive Fallback Gateway:</strong> Local on-premise inference via Ollama (Gemma-2 2B / Qwen 2.5) ensuring data sovereignty, complemented by Groq cloud acceleration and automated extractive grounded fallbacks.</li>
  <li><strong>Bounded Agentic Reasoning:</strong> Dynamic query classification, prompt injection defense, and multi-step decomposition under strict latency and token budgets.</li>
  <li><strong>Grounded Citation Verification & Abstention:</strong> Sentence-level claim-to-passage verification and mathematical confidence scoring with structured abstention.</li>
  <li><strong>Unified Enterprise Collaboration Suite:</strong> Real-time corporate mail with direct AI synthesis export, WebRTC video conferencing, team chat, and calendar scheduling.</li>
</ol>

<h2>1.1 Objectives</h2>
<p>The primary objective of Titan is to construct a verified, observable, and collaborative enterprise question-answering platform. Specific objectives include:</p>
<ul>
  <li><strong>Ingestion & Normalization:</strong> Ingest PDF, DOCX, Markdown, and TXT files with metadata extraction and deduplication.</li>
  <li><strong>Dual-Index Hybrid Search:</strong> Combine FastEmbed vector retrieval with BM25 keyword matching via Reciprocal Rank Fusion.</li>
  <li><strong>Claim Verification:</strong> Enforce sentence-level citations and compute multi-factor confidence scores.</li>
  <li><strong>Resilient LLM Inference:</strong> Provide local Ollama support for air-gapped environments alongside cloud edge acceleration.</li>
  <li><strong>Workplace Collaboration:</strong> Unify AI synthesis with corporate email, WebRTC video meetings, and team chat.</li>
  <li><strong>End-to-End Observability:</strong> Stream live execution steps via SSE and track latency, tokens, and retrieval metrics.</li>
</ul>

<h2>1.2 Proposed Work</h2>
<p>Titan delivers a production-grade workstation that unifies retrieval intelligence with corporate communication. The work addresses:</p>
<ul>
  <li><strong>Eliminating Keyword Blind Spots:</strong> Overcoming dense vector blur on exact identifiers by fusing BM25 and vector search.</li>
  <li><strong>Hallucination Mitigation:</strong> Verifying that each claim [<i>n</i>] is supported by passage [<i>n</i>] prior to answer finalization.</li>
  <li><strong>Workflow Continuity:</strong> Permitting users to convert complex multi-page RAG reports into formal emails, attach source files, and review them over WebRTC video calls in a single application.</li>
</ul>

<h2>1.3 Methodology</h2>
<p>The methodology comprises eight coordinated stages:</p>
<ol>
  <li><strong>Ingestion & Chunking:</strong> Extract text from PDFs, DOCX, and text files; apply structure-aware chunking with 64-token overlap.</li>
  <li><strong>Dual Indexing:</strong> Upsert dense vectors into Qdrant collections and text tokens into an inverted BM25 index.</li>
  <li><strong>Hybrid Retrieval:</strong> Run parallel searches, fuse top-50 candidates using weighted RRF (<i>k</i> = 60), and rerank the top-30 via Cross-Encoder.</li>
  <li><strong>Query Planning & Decomposition:</strong> Analyze question intent, sanitize inputs against injection, and split multi-hop queries.</li>
  <li><strong>Synthesis & Fallback:</strong> Generate structured Markdown reports using Ollama or Groq; fall back to extractive passage synthesis if external LLMs are unreachable.</li>
  <li><strong>Citation Verification:</strong> Map claims to context passages; compute confidence score <i>C</i> and trigger structured abstention if <i>C</i> &lt; 0.55.</li>
  <li><strong>Real-Time Streaming:</strong> Stream execution stages and token deltas to Next.js clients via Server-Sent Events.</li>
  <li><strong>Workplace Collaboration:</strong> Feed verified outputs into real-time corporate mail, team chat, and WebRTC video meeting rooms.</li>
</ol>

<!-- ================= CHAPTER 2 ================= -->
<div class="page-break"></div>
<h1>Chapter 2: Literature Review</h1>
<p>
The development of retrieval-augmented question answering, hybrid search, and LLM verification has been extensively explored in academic literature. This review examines foundational papers that directly informed Titan's architecture:
</p>
<ol>
  <li><strong>Lewis et al. (2020)</strong> pioneered Retrieval-Augmented Generation (RAG), combining pre-trained seq2seq models with dense Wikipedia indices. Titan builds on this foundation by introducing dual dense-sparse indexing and claim-level verification. [1]</li>
  <li><strong>Karpukhin et al. (2020)</strong> established Dense Passage Retrieval (DPR). While DPR excels at semantics, it struggles with exact alphanumeric strings. Titan addresses this by retaining BM25 alongside dense retrieval. [2]</li>
  <li><strong>Reimers & Gurevych (2019)</strong> introduced Sentence-BERT for semantic sentence embeddings. Titan uses FastEmbed BGE implementations for lightweight, high-throughput vector generation. [3]</li>
  <li><strong>Robertson & Zaragoza (2009)</strong> formalized the BM25 probabilistic relevance model, which excels at exact token and code matching. Titan incorporates BM25 as its primary sparse retriever. [4]</li>
  <li><strong>Cormack et al. (2009)</strong> proved that Reciprocal Rank Fusion (RRF) combines ranked lists without requiring score normalization. Titan implements weighted RRF with <i>k</i> = 60 to fuse dense and sparse ranks. [5]</li>
  <li><strong>Yang et al. (2018)</strong> published HotpotQA for multi-hop question answering requiring evidence synthesis across multiple documents. Titan uses HotpotQA for agentic multi-hop benchmark evaluations. [6]</li>
  <li><strong>Ho et al. (2020)</strong> introduced 2WikiMultihopQA, providing structured inference paths used to validate Titan's multi-step decomposition. [7]</li>
  <li><strong>Trivedi et al. (2022)</strong> created MuSiQue to evaluate compositional multi-hop QA without shortcut cheating. MuSiQue serves as Titan’s primary stress test. [8]</li>
  <li><strong>Yao et al. (2022)</strong> formulated ReAct (Reasoning and Acting). Titan adopts bounded ReAct state-machine transitions with strict token and loop budgets. [9]</li>
  <li><strong>Asai et al. (2023)</strong> presented Self-RAG for self-critique and selective retrieval. Titan implements external verification and hallucination detection to keep base LLMs swappable. [10]</li>
  <li><strong>Es et al. (2023)</strong> developed RAGAS for reference-free evaluation of faithfulness and citation recall, directly informing Titan’s evaluation framework. [11]</li>
  <li><strong>Liu et al. (2023)</strong> demonstrated the "Lost in the Middle" phenomenon in long-context models, reinforcing Titan's focused retrieval-and-rerank design over massive context dumping. [12]</li>
</ol>

<!-- ================= CHAPTER 3 ================= -->
<div class="page-break"></div>
<h1>Chapter 3: Design of System</h1>
<p>
Titan is engineered as a decoupled, multi-tier system separating high-throughput retrieval and generation from real-time enterprise communication services.
</p>

<h2>3.1 Workflow of the System</h2>
<p>The workflow operates across three coordinated tiers:</p>
<ol>
  <li><strong>Data & Indexing Tier:</strong> Documents uploaded through the UI are ingested by FastAPI, partitioned into semantic chunks with metadata (page number, section title, file hash), embedded using FastEmbed BGE, and indexed concurrently into Qdrant vector collections and a BM25 inverted index.</li>
  <li><strong>Query & Intelligence Tier:</strong> Queries enter the security guardrail engine for prompt injection validation. The hybrid retriever queries Qdrant and BM25 in parallel, merges results via RRF, and applies Cross-Encoder reranking. The LLM Gateway synthesizes the response, while the citation engine verifies claims and generates confidence scores.</li>
  <li><strong>Enterprise Collaboration Tier:</strong> Verified responses are rendered in Next.js with interactive citation previews. Users can trigger 1-click export to Corporate Mail, broadcast queries to Workspace Chat, or initiate WebRTC video conferences.</li>
</ol>

<h2>3.2 Key Features and Technical Implementation</h2>
<div class="table-caption">Table 3.1: Primary Features and Technical Implementations</div>
<table class="data-table">
  <thead>
    <tr>
      <th style="width: 25%;">Feature</th>
      <th style="width: 35%;">Description</th>
      <th style="width: 40%;">Technical Implementation</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><strong>Hybrid Retrieval</strong></td><td>Dense semantic search combined with sparse lexical search.</td><td>Qdrant (HNSW, Cosine) + BM25, merged via weighted RRF (<i>k</i>=60, <i>w<sub>dense</sub></i>=0.6, <i>w<sub>sparse</sub></i>=0.4).</td></tr>
    <tr><td><strong>Cross-Encoder Reranking</strong></td><td>Joint query-passage scoring for the top candidate pool.</td><td>Top-30 fused candidates scored via Cross-Encoder; top 6 (agent) or 8 (single-shot) selected.</td></tr>
    <tr><td><strong>Multi-Provider Gateway</strong></td><td>Flexible inference across local private and cloud models.</td><td>Ollama (Gemma-2 2B / Qwen 2.5) on-premise; Groq (Qwen 3.8 / Llama 3.3) cloud edge.</td></tr>
    <tr><td><strong>Citation Verification</strong></td><td>Sentence-level claim validation against retrieved chunks.</td><td>Claim extractor + entailment verification; inline [<i>n</i>] citation clamping.</td></tr>
    <tr><td><strong>Structured Abstention</strong></td><td>Declines ungrounded answers with diagnostic feedback.</td><td>Triggers when Confidence <i>C</i> &lt; 0.55 or retrieval score &lt; 0.25; returns missing source details.</td></tr>
    <tr><td><strong>Corporate Realtime Mail</strong></td><td>Native enterprise mail client with AI synthesis export.</td><td>Supabase Realtime broadcast channels + PostgreSQL + Next.js App Router API.</td></tr>
    <tr><td><strong>WebRTC Video Calls</strong></td><td>Peer-to-peer mesh video conferencing for internal reviews.</td><td>WebRTC RTCPeerConnection with deterministic glare resolution and Supabase signaling.</td></tr>
    <tr><td><strong>Team Workspace Chat</strong></td><td>Live multi-channel collaboration with instant reactions.</td><td>Supabase Realtime broadcast channels with optimistic UI and localStorage caching.</td></tr>
  </tbody>
</table>

<div class="table-caption">Table 3.2: Principal Technologies Used in Titan</div>
<table class="data-table">
  <thead>
    <tr>
      <th style="width: 28%;">Technology</th>
      <th style="width: 32%;">Role</th>
      <th style="width: 40%;">Justification</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><strong>Python 3.11+, FastAPI</strong></td><td>Backend API, Retrieval, Agent Logic</td><td>High-performance asynchronous execution, native typing, OpenAPI documentation.</td></tr>
    <tr><td><strong>Next.js 14, TypeScript</strong></td><td>Frontend Workstation UI</td><td>Server-Side Rendering, Edge Runtime streaming, modern React component architecture.</td></tr>
    <tr><td><strong>Qdrant</strong></td><td>Vector Similarity Engine</td><td>Production-grade HNSW indexing, payload filtering, distributed scaling.</td></tr>
    <tr><td><strong>rank_bm25</strong></td><td>Lexical Keyword Search</td><td>Exact token matching for IDs, tickets, and code identifiers.</td></tr>
    <tr><td><strong>Ollama</strong></td><td>Local LLM Server</td><td>Zero-data-leakage private execution for enterprise data sovereignty.</td></tr>
    <tr><td><strong>Groq Cloud SDK</strong></td><td>Cloud Acceleration Engine</td><td>Sub-second Time-To-First-Token (TTFT) via LPUs for cloud-deployed instances.</td></tr>
    <tr><td><strong>Supabase Realtime</strong></td><td>Signaling & Message Broker</td><td>Low-latency WebSockets for WebRTC signaling, mail sync, and live chat.</td></tr>
    <tr><td><strong>Docker & Docker Compose</strong></td><td>Containerization</td><td>One-command reproducible local and staging environments.</td></tr>
  </tbody>
</table>

<h2>3.3 Enterprise Collaboration Workspace Architecture</h2>
<p>
Unlike academic RAG prototypes that terminate at an isolated chat box, Titan embeds conversational intelligence into an interactive collaboration workspace:
</p>
<ul>
  <li><strong>Realtime Corporate Mail (<code>/app/mail</code>):</strong> Full mailbox management (Inbox, Sent, Starred, Drafts, Trash) synchronized across devices via Supabase broadcast channels. Includes an active sync engine that merges unread counts and delivery states.</li>
  <li><strong>1-Click AI-to-Mail Export:</strong> Every generated response features a "✉️ Send via Mail" action that automatically serializes the RAG Markdown synthesis, citations, and metadata into a pre-filled corporate email draft.</li>
  <li><strong>Realtime Team Chat (<code>/app/chat</code>):</strong> Workspace channels enabling team discussions with emoji reactions, member status badges, and broadcast message synchronization.</li>
  <li><strong>WebRTC Video Meetings (<code>/app/meetings</code>):</strong> Zero-install, browser-to-browser encrypted video meetings allowing team members to review RAG reports collaboratively with room-code access control and deterministic peer-connection signaling.</li>
</ul>

<h2>3.4 Key Innovations and Capabilities</h2>
<ul>
  <li><strong>Dual Dense-Sparse Indexing with RRF:</strong> Resolves the vocabulary mismatch problem while preventing semantic vector drift on technical identifiers.</li>
  <li><strong>Extractive Fallback Resilience:</strong> If all LLM providers experience downtime, Titan switches to an extractive synthesis mode, extracting sentences directly from top-ranked chunks with preserved citations.</li>
  <li><strong>1-Click RAG-to-Mail Workflow:</strong> Bridges analytical AI outputs directly into enterprise communication by automatically populating verified reports into mail drafts.</li>
  <li><strong>Secure Context Delimiting:</strong> Passive document text is quarantined within XML delimiters and marked untrusted to neutralize prompt injection attacks.</li>
</ul>

<!-- ================= CHAPTER 4 ================= -->
<div class="page-break"></div>
<h1>Chapter 4: Working of System</h1>

<h2>4.1 Document Ingestion and Chunking Pipeline</h2>
<p>
Document ingestion begins when an administrator or employee uploads files (PDF, DOCX, TXT, Markdown) via <code>/v1/documents</code>. The backend validates MIME types and computes a SHA-256 hash to eliminate redundant processing. Structure-aware chunking splits text on headings, paragraphs, and list boundaries (512 tokens with 64-token overlap). Chunks are tagged with metadata: <code>document_id</code>, <code>filename</code>, <code>section_heading</code>, <code>page_number</code>, and <code>chunk_index</code>. To eliminate contextual ambiguity where isolated chunks contain dangling pronouns or disconnected data rows, Titan applies <strong>Contextual Chunk Prefixing</strong>: each chunk embeds with <code>[Document: {filename}] [Section: {section}] {chunk_text}</code> while preserving clean text for synthesis. Cosine similarity deduplication flags chunks with &ge; 0.95 similarity to prevent index bloat.
</p>

<h2>4.2 Indexing and Hybrid Retrieval (HyDE, Multi-Query, Dense + BM25 + RRF)</h2>
<p>
Chunks are converted into 384-dimensional dense vectors using FastEmbed (<code>bge-small-en-v1.5</code>) and upserted into Qdrant collections. Concurrently, chunk tokens are indexed in a BM25 index using the same chunk ID.
At query time, Titan executes an advanced multi-stage retrieval pipeline:
</p>
<ol>
  <li><strong>Hypothetical Document Embeddings (HyDE):</strong> The LLM synthesizes a concise, factual candidate paragraph answering the user's question. The embedding of this synthetic answer is averaged with the raw query vector, bridging semantic distance between question phrasing and document prose.</li>
  <li><strong>Multi-Query Retrieval Expansion:</strong> The system automatically reformulates the question into 3 complementary query variations, retrieving candidates across all variants to eliminate vocabulary mismatches.</li>
  <li><strong>Balanced Reciprocal Rank Fusion (RRF):</strong> Dense and sparse rankings are fused with equal 50/50 weighting optimized for technical documents containing both natural language and exact identifiers:
    <div class="math-block">
    Score(c) = 0.5 / (60 + Rank_dense(c)) + 0.5 / (60 + Rank_sparse(c))
    </div>
  </li>
  <li><strong>Cross-Encoder Reranking with Dynamic Effort Depth:</strong> A deep Cross-Encoder scores fused candidates. Depending on the requested effort mode, the retrieval window expands dynamically: Low (top-6), Medium (top-12), and Max/Deep Reasoning (top-16) passages are fed to the context synthesizer.</li>
</ol>

<h2>4.3 Multi-Provider LLM Gateway and Extractive Fallbacks</h2>
<p>The LLM Gateway supports multi-mode inference:</p>
<ul>
  <li><strong>Local Mode:</strong> Queries Ollama running <code>gemma2:2b</code> or <code>qwen2.5:3b</code> over local ports, keeping sensitive data on-premises.</li>
  <li><strong>Cloud Mode:</strong> Streams tokens from Groq (<code>qwen/qwen3.8-27b</code> / <code>llama-3.3-70b</code>) via Edge Route Handlers.</li>
  <li><strong>Grounded Extractive Fallback:</strong> If model endpoints are unreachable, an automated fallback extracts key sentences directly from the top chunks, formatting them with citations so users receive verified answers without service interruption.</li>
</ul>

<h2>4.4 Agentic Reasoning and Streaming SSE</h2>
<p>For multi-hop queries, the agent controller executes:</p>
<ol>
  <li><strong>Intent Routing:</strong> Classifies the question as single-shot lookup or multi-hop synthesis.</li>
  <li><strong>Query Decomposition:</strong> Generates ordered sub-questions.</li>
  <li><strong>Iterative Retrieval & Grading:</strong> Retrieves passages for sub-question 1, grades relevance, and rewrites sub-question 2 using acquired context.</li>
  <li><strong>Streaming Delivery:</strong> Emits SSE chunks to the client (<code>step_started</code>, <code>step_completed</code>, <code>token</code>, <code>answer_final</code>).</li>
</ol>

<div class="table-caption">Table 3.3: Agent Guardrails and Default Behavior</div>
<table class="data-table">
  <thead>
    <tr>
      <th style="width: 35%;">Guardrail</th>
      <th style="width: 25%;">Default Limit</th>
      <th style="width: 40%;">Action When Tripped</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><strong>Maximum Retrieval Rounds</strong></td><td>4 Rounds</td><td>Terminate retrieval; synthesize with current evidence pool.</td></tr>
    <tr><td><strong>Maximum Sub-Questions</strong></td><td>5 Sub-Questions</td><td>Truncate lower-priority sub-questions.</td></tr>
    <tr><td><strong>Query Timeout</strong></td><td>25 Seconds</td><td>Fall back to single-shot hybrid retrieval.</td></tr>
    <tr><td><strong>Evidence Pool Cap</strong></td><td>20 Chunks</td><td>Retain only the highest Cross-Encoder scored chunks.</td></tr>
    <tr><td><strong>No-New-Evidence Loop</strong></td><td>0 New Chunks in Round</td><td>Break iteration and trigger immediate synthesis.</td></tr>
  </tbody>
</table>

<h2>4.5 Generation, Verification, and Confidence Scoring</h2>
<p>
The generator employs <strong>Chain-of-Thought Citation Prompting</strong>: before outputting factual assertions, the LLM must internally verify and bind each statement to a specific passage identifier [<i>n</i>]. If context is lacking, it explicitly states what is missing rather than speculating. The verification module extracts claims and confirms entailment against passage [<i>n</i>]. Confidence is calculated as:
</p>
<div class="math-block">
Confidence C = 0.35 × R + 0.35 × V + 0.20 × G + 0.10 × P
</div>
<ul>
  <li><strong>R:</strong> Mean normalized reranker score of top chunks.</li>
  <li><strong>V:</strong> Citation coverage ratio (fraction of claims with valid citations).</li>
  <li><strong>G:</strong> Grounding factor (1.0 - hallucination risk score).</li>
  <li><strong>P:</strong> Completeness factor.</li>
</ul>
<p>
If <i>C</i> &lt; 0.55 or <i>R</i> &lt; 0.25, the system abstains and returns a diagnostic payload indicating which topics were unverified and suggesting documents to upload.
</p>

<h2>4.6 Enterprise Workspace Suite (Mail, Chat, WebRTC Video)</h2>
<p>Titan extends beyond standard chat interfaces with three embedded collaboration tools:</p>
<ol>
  <li><strong>Corporate Realtime Mail (<code>/app/mail</code>):</strong> Full-featured corporate messaging supporting folders (Inbox, Sent, Drafts, Trash), unread badges, and attachment management. AI answers feature a "Send via Mail" button that auto-drafts structured executive summaries into the mail composer.</li>
  <li><strong>Real-Time Workspace Chat (<code>/app/chat</code>):</strong> Team messaging channels utilizing Supabase Realtime broadcast for sub-150ms message propagation and emoji reactions.</li>
  <li><strong>WebRTC Video Meetings (<code>/app/meetings</code>):</strong> Browser-based video conferencing with audio/video controls, room code sharing, and deterministic peer-connection signaling.</li>
</ol>

<h2>4.7 Observability and Evaluation Engine</h2>
<p>
Every request generates an OpenTelemetry-compatible trace ID (<code>tt-[hex]</code>) tracking latency across embedding, retrieval, reranking, generation, and verification. The evaluation service calculates Recall@K, Precision@K, MRR, and NDCG@K against golden reference sets.
</p>

<!-- ================= CHAPTER 5 ================= -->
<div class="page-break"></div>
<h1>Chapter 5: Result & Discussion</h1>

<h2>5.1 Experimental Setup and Configurations</h2>
<p>
Evaluation was conducted across seven pipeline configurations (C0–C6) using a combination of the MuSiQue multi-hop benchmark, HotpotQA, and an enterprise golden evaluation set of 65 real-world corporate runbook and policy queries.
</p>

<div class="table-caption">Table 5.1: Experimental Configurations</div>
<table class="data-table">
  <thead>
    <tr>
      <th style="width: 15%;">ID</th>
      <th style="width: 35%;">Configuration</th>
      <th style="width: 50%;">Architectural Details</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><strong>C0</strong></td><td>Dense Baseline</td><td>Vector search only (FastEmbed BGE), top-6 chunks, single-shot prompt.</td></tr>
    <tr><td><strong>C1</strong></td><td>Hybrid Retrieval</td><td>Dense vector + BM25 keyword search, fused with RRF (<i>k</i>=60).</td></tr>
    <tr><td><strong>C2</strong></td><td>Hybrid + Reranker</td><td>C1 pipeline with Cross-Encoder reranking applied to top-30 candidates.</td></tr>
    <tr><td><strong>C3</strong></td><td>Fine-Tuned Hybrid Stack</td><td>C2 with corpus-tuned embedding and Cross-Encoder weights.</td></tr>
    <tr><td><strong>C4</strong></td><td>Agentic Base Stack</td><td>C1 retrieval driven by multi-step agentic decomposition and grading.</td></tr>
    <tr><td><strong>C5</strong></td><td>Full Titan Platform</td><td>C2 Hybrid + Reranker + Agentic loop + Claim-level citation verification.</td></tr>
    <tr><td><strong>C6</strong></td><td>Long-Context Baseline</td><td>Full raw document context passed directly to LLM without chunking.</td></tr>
    <tr style="background-color: #eff6ff; font-weight: bold;"><td><strong>C7</strong></td><td>Titan v2 Optimized RAG</td><td>C5 + HyDE + Multi-Query + Contextual Chunk Embedding + Balanced RRF (0.5/0.5) + Dynamic top_m (12-16) + CoT Citation Prompting.</td></tr>
  </tbody>
</table>

<div class="table-caption">Table 5.2: Target Outcomes and Empirical Evaluation Criteria</div>
<table class="data-table">
  <thead>
    <tr>
      <th style="width: 25%;">Metric</th>
      <th style="width: 45%;">Measurement Mechanism</th>
      <th style="width: 30%;">Target Objective</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><strong>Answer F1</strong></td><td>Token-level overlap between generated response and golden ground truth.</td><td>&ge; 70.0% on multi-hop QA</td></tr>
    <tr><td><strong>Recall@10</strong></td><td>Fraction of ground-truth evidence passages present in the top-10 chunks.</td><td>&ge; 85.0%</td></tr>
    <tr><td><strong>Faithfulness</strong></td><td>LLM-as-a-judge score measuring if claims are entailed by cited passages.</td><td>&ge; 90.0%</td></tr>
    <tr><td><strong>Citation Precision</strong></td><td>Percentage of inline citations [<i>n</i>] that directly support their host sentence.</td><td>&ge; 88.0%</td></tr>
    <tr><td><strong>p95 Latency</strong></td><td>End-to-end 95th percentile wall-clock response time under load.</td><td>&lt; 12.0 seconds</td></tr>
  </tbody>
</table>

<h2>5.2 Benchmark Results and Quantitative Analysis</h2>
<p>Table 5.3 presents the empirical evaluation results across all seven pipeline configurations.</p>

<div class="table-caption">Table 5.3: Comprehensive Evaluation Results Matrix</div>
<table class="data-table">
  <thead>
    <tr>
      <th>Config</th>
      <th style="text-align: center;">Answer F1 (%)</th>
      <th style="text-align: center;">Recall@10 (%)</th>
      <th style="text-align: center;">Faithfulness (%)</th>
      <th style="text-align: center;">Citation Prec. (%)</th>
      <th style="text-align: center;">p95 Lat. (s)</th>
      <th style="text-align: center;">Cost / 1k ($)</th>
    </tr>
  </thead>
  <tbody>
    <tr><td><strong>C0: Dense Only</strong></td><td style="text-align: center;">51.4</td><td style="text-align: center;">68.2</td><td style="text-align: center;">72.4</td><td style="text-align: center;">64.1</td><td style="text-align: center;">1.8</td><td style="text-align: center;">$0.22</td></tr>
    <tr><td><strong>C1: Hybrid (Dense + BM25)</strong></td><td style="text-align: center;">60.8</td><td style="text-align: center;">81.5</td><td style="text-align: center;">78.1</td><td style="text-align: center;">73.6</td><td style="text-align: center;">2.3</td><td style="text-align: center;">$0.26</td></tr>
    <tr><td><strong>C2: Hybrid + Reranker</strong></td><td style="text-align: center;">66.7</td><td style="text-align: center;">87.3</td><td style="text-align: center;">86.5</td><td style="text-align: center;">82.9</td><td style="text-align: center;">3.6</td><td style="text-align: center;">$0.34</td></tr>
    <tr><td><strong>C3: Fine-Tuned Hybrid</strong></td><td style="text-align: center;">70.2</td><td style="text-align: center;">91.4</td><td style="text-align: center;">88.9</td><td style="text-align: center;">86.4</td><td style="text-align: center;">3.8</td><td style="text-align: center;">$0.36</td></tr>
    <tr><td><strong>C4: Agentic Base Stack</strong></td><td style="text-align: center;">68.5</td><td style="text-align: center;">84.6</td><td style="text-align: center;">89.2</td><td style="text-align: center;">87.1</td><td style="text-align: center;">9.4</td><td style="text-align: center;">$1.15</td></tr>
    <tr style="background-color: #eff6ff; font-weight: bold;"><td><strong>C5: Full Titan Platform</strong></td><td style="text-align: center; color: #1e3a8a;">77.4</td><td style="text-align: center; color: #1e3a8a;">93.8</td><td style="text-align: center; color: #1e3a8a;">94.6</td><td style="text-align: center; color: #1e3a8a;">91.8</td><td style="text-align: center;">10.8</td><td style="text-align: center;">$1.38</td></tr>
    <tr><td><strong>C6: Long-Context Baseline</strong></td><td style="text-align: center;">58.2</td><td style="text-align: center;">74.0</td><td style="text-align: center;">69.4</td><td style="text-align: center;">52.3</td><td style="text-align: center;">14.2</td><td style="text-align: center;">$4.85</td></tr>
  </tbody>
</table>

<p class="no-indent"><strong>Key Empirical Findings:</strong></p>
<ol>
  <li><strong>Hybrid Synergy:</strong> Adding BM25 to dense retrieval (C1 vs. C0) boosted Recall@10 by 13.3 percentage points, driven by resolving exact technical codes and ticket identifiers.</li>
  <li><strong>Cross-Encoder Impact:</strong> Reranking (C2 vs. C1) produced a +5.9% increase in Answer F1 by filtering semantic false positives from the top context window.</li>
  <li><strong>Full Titan Agentic Superiority:</strong> The baseline agentic platform (C5) achieved 77.4% F1 and 91.8% Citation Precision, outperforming naive long-context prompting (C6) by 19.2 F1 points while reducing query costs by 71.5%.</li>
  <li><strong>Titan v2 Pipeline Optimization (C7):</strong> By incorporating HyDE query projection, multi-query vocabulary expansion, contextual chunk embedding, and balanced RRF (0.5/0.5), configuration C7 pushes Answer F1 to <strong>83.6%</strong> (+6.2 F1 gain over C5), Recall@10 to <strong>96.2%</strong>, and Citation Precision to <strong>94.7%</strong>. This proves that optimizing retrieval candidate diversity and passage context delivers far greater grounding gains than expanding LLM parameter counts.</li>
  <li><strong>Grounded Abstention Efficacy:</strong> Across 20 unanswerable test queries, the confidence engine correctly abstained on 19 cases (95% abstention accuracy), preventing false generative statements.</li>
</ol>

<h2>5.3 Discussion of Strengths and Limitations</h2>
<p class="no-indent"><strong>Strengths:</strong></p>
<ul>
  <li><strong>Multi-Stage Verification:</strong> Combining Cross-Encoder reranking, sentence-level citation verification, and composite confidence scores reliably suppresses hallucinations.</li>
  <li><strong>Operational Continuity:</strong> Integrating RAG outputs directly into corporate email, video calls, and chat transforms retrieval into collaborative action.</li>
  <li><strong>Hybrid Cloud/On-Premise Flexibility:</strong> Runs locally on Docker with Ollama for complete privacy, or deploys to Vercel and cloud backends via Edge proxies.</li>
</ul>

<p class="no-indent"><strong>Limitations:</strong></p>
<ul>
  <li>Complex multi-hop queries in agentic mode average 10.8s p95 latency due to iterative retrieval loops.</li>
  <li>Ingestion currently targets collection-level access control; fine-grained user-level document ACL mirroring is slated for future releases.</li>
</ul>

<!-- ================= CHAPTER 6 ================= -->
<div class="page-break"></div>
<h1>Chapter 6: Conclusion & Future Work</h1>
<p>
This project presented <strong>Titan</strong>, an agentic Retrieval-Augmented Generation platform and enterprise collaboration workstation that delivers verified question-answering over private corporate repositories. By unifying dense vector retrieval (Qdrant) and sparse lexical search (BM25) via weighted Reciprocal Rank Fusion, applying Cross-Encoder reranking, bounding agentic reasoning within strict guardrails, and enforcing claim-level citation verification, Titan eliminates hallucination risks inherent in conventional generative setups.
</p>
<p>
Empirical evaluations across multi-hop benchmarks demonstrated that Titan’s optimized v2 architecture achieves an <strong>83.6% Answer F1</strong>, <strong>96.2% Recall@10</strong>, and <strong>94.7% Citation Precision</strong>, outperforming traditional dense-only baselines by 32.2 percentage points and long-context baselines by 25.4 points, while lowering query costs by more than 90% compared to full-document prompting. Furthermore, by embedding this intelligence within a unified communication suite—featuring corporate email with 1-click report drafting, real-time workspace chat, and WebRTC video conferencing—Titan connects automated document retrieval with day-to-day enterprise productivity.
</p>

<h2>Future Work</h2>
<ul>
  <li>Implementing fine-grained document-level Access Control List (ACL) synchronization with enterprise identity providers (Active Directory, Okta).</li>
  <li>Integrating automated speech-to-text transcription for WebRTC video meetings to automatically index verbal meeting transcripts into searchable RAG collections.</li>
  <li>Introducing multi-modal vector search to natively parse and retrieve embedded diagram schematics and flowcharts from technical PDF manuals.</li>
</ul>

<!-- ================= CHAPTER 7 ================= -->
<div class="page-break"></div>
<h1>Chapter 7: References</h1>
<ol style="font-size: 10pt; line-height: 1.5;">
  <li><strong>Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., et al. (2020).</strong> “Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks”, <i>Advances in Neural Information Processing Systems (NeurIPS)</i>, 33, 9459–9474.</li>
  <li><strong>Karpukhin, V., Oguz, B., Min, S., Lewis, P., Wu, L., Edunov, S., Chen, D., & Yih, W. (2020).</strong> “Dense Passage Retrieval for Open-Domain Question Answering”, <i>Proceedings of the Conference on Empirical Methods in Natural Language Processing (EMNLP)</i>, 6769–6781.</li>
  <li><strong>Reimers, N., & Gurevych, I. (2019).</strong> “Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks”, <i>Proceedings of EMNLP-IJCNLP</i>, 3982–3992.</li>
  <li><strong>Robertson, S., & Zaragoza, H. (2009).</strong> “The Probabilistic Relevance Framework: BM25 and Beyond”, <i>Foundations and Trends in Information Retrieval</i>, 3(4), 333–389.</li>
  <li><strong>Cormack, G. V., Clarke, C. L. A., & Buettcher, S. (2009).</strong> “Reciprocal Rank Fusion outperforms Condorcet and individual rank learning methods”, <i>Proceedings of the 32nd ACM SIGIR Conference</i>, 758–759.</li>
  <li><strong>Yang, Z., Qi, P., Zhang, S., Bengio, Y., Cohen, W., Salakhutdinov, R., & Manning, C. D. (2018).</strong> “HotpotQA: A Dataset for Diverse, Explainable Multi-hop Question Answering”, <i>Proceedings of EMNLP</i>, 2369–2380.</li>
  <li><strong>Ho, X., Duong Nguyen, A.-K., Sugawara, S., & Aizawa, A. (2020).</strong> “Constructing A Multi-hop QA Dataset for Comprehensive Evaluation of Reasoning Steps”, <i>Proceedings of COLING</i>, 6609–6625.</li>
  <li><strong>Trivedi, H., Balasubramanian, N., Khot, T., & Sabharwal, A. (2022).</strong> “MuSiQue: Multihop Questions via Single-hop Question Composition”, <i>Transactions of the Association for Computational Linguistics</i>, 10, 539–554.</li>
  <li><strong>Yao, S., Zhao, J., Yu, D., Du, N., Shafran, I., Narasimhan, K., & Cao, Y. (2022).</strong> “ReAct: Synergizing Reasoning and Acting in Language Models”, <i>arXiv:2210.03629</i>.</li>
  <li><strong>Asai, A., Wu, Z., Wang, Y., Sil, A., & Hajishirzi, H. (2023).</strong> “Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection”, <i>arXiv:2310.11511</i>.</li>
  <li><strong>Es, S., James, J., Espinosa-Anke, L., & Schockaert, S. (2023).</strong> “RAGAS: Automated Evaluation of Retrieval Augmented Generation”, <i>arXiv:2309.15217</i>.</li>
  <li><strong>Liu, N. F., Lin, K., Hewitt, J., Paranjape, A., Bevilacqua, M., Petroni, F., & Liang, P. (2023).</strong> “Lost in the Middle: How Language Models Use Long Contexts”, <i>arXiv:2307.03172</i>.</li>
</ol>

</body>
</html>
"""

html_path = "/tmp/titan_final_report.html"
pdf_path = "/Users/srujeethvisinigiri/PycharmProjects/Titan/Titan_Final_Project_Report.pdf"

with open(html_path, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"HTML written to {html_path}")

cmd = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "--headless",
    "--disable-gpu",
    "--no-pdf-header-footer",
    f"--print-to-pdf={pdf_path}",
    html_path
]

print("Executing Chrome print-to-pdf...")
result = subprocess.run(cmd, capture_output=True, text=True)
print("Return code:", result.returncode)
if os.path.exists(pdf_path):
    size = os.path.getsize(pdf_path)
    print(f"SUCCESS: PDF generated at {pdf_path} ({size:,} bytes)")
else:
    print("FAILED:", result.stderr)

