#!/usr/bin/env python3
"""Generates the per-vendor 'alternative' SEO pages. Run from repo root: python3 build-alt-pages.py"""
import json, os

BASE = "https://tanzir71.github.io/tinyproctorjs"
OUT = os.path.dirname(os.path.abspath(__file__))

VENDORS = [
    {
        "slug": "proctorio-alternative",
        "name": "Proctorio",
        "h1": "A free, privacy-first Proctorio alternative",
        "title": "Free Proctorio Alternative (No Webcam, Self-Hosted) — tinyproctor.js",
        "desc": "Looking for a Proctorio alternative without webcam recording, browser extensions, or per-student fees? tinyproctor.js is a free, open-source, self-hosted exam integrity monitor that runs from a single script tag.",
        "what": "Proctorio is a commercial automated proctoring platform delivered as a browser extension. Depending on the configuration an institution chooses, it can record webcam, microphone, and screen, verify identity, and use machine-learning models to flag suspicious behavior for later review. Pricing is institutional and quote-based.",
        "differs": "tinyproctor.js takes the opposite approach: no recording of any kind, no extension to install, no vendor cloud. It observes browser-level integrity signals (tab switches, focus loss, fullscreen exits, copy/paste, DevTools heuristics, idle time), scores them, and reports them to an endpoint on your own server.",
        "rows": [
            ("Delivery", "One script tag on the exam page", "Chrome/Edge browser extension"),
            ("Webcam / mic / screen recording", "Never", "Yes, configurable by institution"),
            ("Where data lives", "Your server only", "Vendor cloud (zero-knowledge encryption claimed)"),
            ("Student install required", "None", "Extension install required"),
            ("Cost", "Free, MIT license", "Institutional quote-based licensing"),
            ("Bypass resistance", "Deterrence-level (in-page JS)", "Higher (extension + recording review)"),
        ],
        "choose_them": "you run high-stakes certification or accreditation exams where recorded evidence and identity verification are mandatory, and your candidates accept camera access.",
        "choose_us": "you run quizzes, course assessments, or internal certifications where webcam proctoring is disproportionate, you have privacy-sensitive students or a works council/GDPR constraint, or you simply need a free deterrence-and-triage layer this semester.",
        "faq": [
            ("Does tinyproctor.js record students like Proctorio?", "No. It never accesses camera, microphone, or screen content. It only records that integrity-relevant browser events happened (e.g. the tab was hidden), never the content of what a student did."),
            ("Is tinyproctor.js really free for commercial use?", "Yes. It is MIT-licensed: free for schools, universities, and commercial training platforms with no per-student or per-exam fees."),
            ("Can tinyproctor.js fully replace Proctorio?", "For low- and medium-stakes assessments, often yes. For high-stakes exams that require identity verification and recorded evidence, no client-side script can replace recorded proctoring — combine layers instead."),
        ],
    },
    {
        "slug": "honorlock-alternative",
        "name": "Honorlock",
        "h1": "A free, no-webcam Honorlock alternative",
        "title": "Free Honorlock Alternative (No Per-Exam Fees) — tinyproctor.js",
        "desc": "Honorlock charges per student or per session for AI + live proctoring. tinyproctor.js is a free, self-hosted alternative for low/medium-stakes exams: browser integrity signals, no webcam, no extension, no fees.",
        "what": "Honorlock is a hybrid proctoring service that combines AI monitoring with live human proctors who can intervene during an exam session. It typically uses a browser extension plus webcam and screen recording, and is priced per student or per exam session, which scales with usage.",
        "differs": "tinyproctor.js has no humans, no AI review queue, and no recordings — and therefore no per-session invoice. It gives your existing exam platform real-time integrity telemetry (tab switches, focus loss, paste events, fullscreen exits, idle gaps) that your own staff review on your own infrastructure.",
        "rows": [
            ("Delivery", "One script tag on the exam page", "Browser extension + webcam session"),
            ("Live human proctors", "No", "Yes (pop-in intervention model)"),
            ("Recording", "Never", "Webcam + screen, AI-flagged"),
            ("Where data lives", "Your server only", "Vendor cloud"),
            ("Cost", "Free, MIT license", "Per-student / per-session pricing"),
            ("Setup time", "Minutes (script + endpoint)", "Procurement, onboarding, LMS integration"),
        ],
        "choose_them": "you need live intervention during exams, identity verification, or recorded evidence for academic-integrity hearings — and the per-session economics work for your exam volume.",
        "choose_us": "your exam volume makes per-session pricing painful, your assessments are low/medium-stakes, or you want integrity signals inside your own platform without sending student data to a third party.",
        "faq": [
            ("How much does tinyproctor.js cost compared to Honorlock?", "tinyproctor.js is free and MIT-licensed with no per-student or per-session fees. Honorlock is commercial and typically priced per student or per exam session; contact the vendor for a quote."),
            ("Does tinyproctor.js have live proctors?", "No. It is a monitoring library, not a proctoring service. It produces a violation timeline and integrity score that your own instructors or admins review."),
            ("Can I use tinyproctor.js with my LMS?", "Yes — any platform where you can add a script tag to the exam page works, including Moodle, WordPress LMS plugins, and custom exam systems."),
        ],
    },
    {
        "slug": "respondus-lockdown-browser-alternative",
        "name": "Respondus LockDown Browser",
        "h1": "A no-install Respondus LockDown Browser alternative",
        "title": "Free Respondus LockDown Browser Alternative (No Install) — tinyproctor.js",
        "desc": "Respondus LockDown Browser requires every student to install a special browser under an annual institutional license. tinyproctor.js monitors exam integrity in any normal browser — free, open source, one script tag.",
        "what": "Respondus LockDown Browser is an installable, locked-down custom browser licensed annually to institutions. While active, it prevents switching applications, copying, printing, and visiting other sites. It is often paired with Respondus Monitor for webcam recording.",
        "differs": "tinyproctor.js follows a detection model instead of a prevention model. Students use their normal browser with zero installs — the script detects and reports tab switches, focus loss, copy/paste, print attempts and more, and can optionally block clipboard and right-click. Detection can't physically stop a determined cheater the way a lockdown browser can, but it also eliminates the #1 support headache: installation problems on exam day.",
        "rows": [
            ("Student install", "None — any modern browser", "Custom browser must be installed"),
            ("Model", "Detect, score & report", "Prevent & lock down"),
            ("Chromebooks / managed devices", "Works (it's just a web page)", "Requires supported install"),
            ("Copy/paste & right-click", "Detected, optionally blocked", "Blocked"),
            ("Cost", "Free, MIT license", "Annual institutional license"),
            ("Exam-day support burden", "Minimal", "Installs, updates, compatibility issues"),
        ],
        "choose_them": "your institution mandates hard prevention — exams must be physically impossible to leave — and you have IT capacity to support installs across student devices.",
        "choose_us": "you can't ask students to install software (BYOD, library machines, remote learners), you want integrity evidence rather than lockdown, or you need something deployable today at zero cost.",
        "faq": [
            ("Can tinyproctor.js lock down the browser like Respondus?", "No, and it doesn't try to. It detects and reports violations rather than preventing them, and can optionally block clipboard and right-click. A web page cannot prevent app switching — only an installed kiosk app can."),
            ("Do students need to install anything?", "Nothing. The script is part of the exam page itself and works in any modern browser, including on Chromebooks, tablets, and phones."),
            ("Is detection enough to stop cheating?", "Visible monitoring measurably deters casual cheating, and the violation timeline gives instructors evidence for follow-up. For high-stakes finals, combine it with question randomization, time limits, and human review."),
        ],
    },
    {
        "slug": "safe-exam-browser-alternative",
        "name": "Safe Exam Browser",
        "h1": "A zero-install Safe Exam Browser alternative",
        "title": "Safe Exam Browser Alternative Without Installs — tinyproctor.js",
        "desc": "Safe Exam Browser is a free kiosk lockdown app that students must install and configure. tinyproctor.js is the zero-install counterpart: free, open-source browser integrity monitoring from a single script tag.",
        "what": "Safe Exam Browser (SEB) is a free, open-source lockdown application for Windows, macOS and iOS. It opens the exam in kiosk mode, blocks app switching and system shortcuts, and integrates with Moodle, ILIAS, OpenOLAT and several commercial exam systems. It's the strongest free prevention tool available.",
        "differs": "tinyproctor.js is also free and open source, but solves the opposite half of the problem: telemetry instead of lockdown, zero install instead of managed configuration. The two are complementary — SEB prevents what it can, tinyproctor.js records what happened. For cohorts where installing SEB is impractical (BYOD, remote, mobile), tinyproctor.js is the lighter-weight option.",
        "rows": [
            ("Install & config", "None — one script tag", "App install + .seb config files"),
            ("Model", "Detect, score & report", "Kiosk-mode prevention"),
            ("Platforms", "Any modern browser incl. mobile", "Windows, macOS, iOS apps"),
            ("Integrity timeline / dashboard data", "Yes — events POST to your server", "No telemetry by itself"),
            ("Cost", "Free, MIT license", "Free, open source (MPL)"),
            ("Best at", "Low-friction monitoring & evidence", "Hard prevention on managed devices"),
        ],
        "choose_them": "you control the devices (computer labs, managed laptops) or your students can reliably install software, and prevention matters more than telemetry.",
        "choose_us": "installs are impossible or risky for your cohort, you need an audit trail of what happened during attempts, or you want monitoring on mobile devices. Many teams run both: SEB where they can, tinyproctor.js everywhere else.",
        "faq": [
            ("Are both tools really free?", "Yes. Safe Exam Browser is open source under MPL; tinyproctor.js is open source under MIT. Neither charges per student or per exam."),
            ("Can I use tinyproctor.js inside Safe Exam Browser?", "Yes. SEB renders normal web pages, so the script runs fine inside it — giving you SEB's prevention plus tinyproctor's event timeline in one setup."),
            ("Which is more secure?", "SEB. Kiosk-mode lockdown is categorically stronger than in-page JavaScript. tinyproctor.js trades some enforcement strength for zero-install deployment and server-side telemetry."),
        ],
    },
]

STYLE = """
        :root {
            --bg: #ffffff; --fg: #09090b; --muted: #52525b; --muted-2: #71717a;
            --border: #e4e4e7; --panel: #ffffff; --hover: #fafafa;
        }
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { margin: 0; background: var(--bg); color: var(--fg); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; line-height: 1.6; }
        a { color: inherit; text-decoration: none; }
        .container { margin: 0 auto; max-width: 1152px; padding: 0 16px; }
        header { position: sticky; top: 0; z-index: 40; border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.85); backdrop-filter: blur(10px); }
        .header-inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 0; }
        .brand { display: inline-flex; align-items: center; gap: 12px; }
        .logo { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--border); }
        .logo span { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; }
        .brand-name { font-size: 14px; font-weight: 600; letter-spacing: -0.02em; }
        nav { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 14px; }
        .nav-link { display: inline-flex; height: 36px; align-items: center; border-radius: 8px; padding: 0 8px; color: var(--muted); }
        .nav-link:hover { background: var(--hover); color: var(--fg); }
        .btn { display: inline-flex; align-items: center; justify-content: center; height: 40px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg); color: var(--fg); font-size: 14px; font-weight: 500; }
        .btn:hover { background: var(--hover); }
        .btn-primary { background: var(--fg); border-color: var(--fg); color: #fff; }
        .btn-primary:hover { background: #18181b; }
        .site-menu { display: flex; align-items: center; margin-left: auto; }
        .menu-toggle { display: none; }
        .menu-toggle::-webkit-details-marker { display: none; }
        .menu-toggle span { display: block; width: 18px; height: 2px; background: currentColor; transition: transform 120ms ease, opacity 120ms ease; }
        @media (max-width: 639px) {
            .header-inner { position: relative; min-height: 58px; align-items: center; flex-direction: row; gap: 12px; }
            header .brand { min-width: 0; }
            header .brand-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .site-menu { flex: none; margin-left: auto; }
            .menu-toggle { display: inline-grid; width: 40px; height: 40px; place-items: center; gap: 4px; border: 1px solid var(--fg); background: transparent; color: var(--fg); cursor: pointer; }
            .menu-toggle:focus-visible { outline: 2px solid var(--focus, #2540ff); outline-offset: 2px; }
            header nav { display: none; position: absolute; left: 0; right: 0; top: calc(100% + 1px); z-index: 50; flex-direction: column; align-items: stretch; justify-content: flex-start; gap: 4px; margin: 0; padding: 8px; overflow: visible; border: 1px solid var(--border); background: var(--bg); box-shadow: 0 18px 36px rgba(10, 10, 10, 0.14); }
            .site-menu[open] nav { display: flex; }
            header .nav-link, header .btn { width: 100%; height: 42px; justify-content: flex-start; padding: 0 12px; }
            header .btn-primary { justify-content: center; }
            main, .layout > *, .grid > *, .demo-grid > *, .hero-grid > *, .paths > * { min-width: 0; }
            pre, .snippet, .table-wrap { max-width: 100%; }
            .site-menu[open] .menu-toggle span:nth-child(1) { transform: translateY(6px) rotate(45deg); }
            .site-menu[open] .menu-toggle span:nth-child(2) { opacity: 0; }
            .site-menu[open] .menu-toggle span:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }
        }
        .mono, code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        code { font-size: 0.9em; background: var(--hover); border: 1px solid var(--border); border-radius: 6px; padding: 1px 5px; }
        .hero { padding: 56px 0 8px; }
        .pill { display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; border: 1px solid var(--border); padding: 6px 12px; font-size: 12px; color: var(--muted); }
        h1 { margin: 10px 0 0; font-size: 34px; font-weight: 600; letter-spacing: -0.03em; line-height: 1.15; max-width: 760px; }
        @media (min-width: 640px) { h1 { font-size: 44px; } }
        .lead { margin-top: 14px; max-width: 700px; font-size: 16px; line-height: 1.75; color: var(--muted); }
        .section { padding: 36px 0 0; }
        .section:last-of-type { padding-bottom: 72px; }
        h2 { margin: 0 0 8px; font-size: 21px; font-weight: 600; letter-spacing: -0.02em; }
        h3 { margin: 20px 0 0; font-size: 15px; font-weight: 600; }
        p { margin: 8px 0 0; font-size: 14.5px; color: var(--muted); max-width: 760px; }
        p strong { color: var(--fg); }
        .table-wrap { overflow-x: auto; margin-top: 16px; border: 1px solid var(--border); border-radius: 12px; }
        table { width: 100%; border-collapse: collapse; min-width: 640px; font-size: 13.5px; }
        thead th { text-align: left; font-size: 11.5px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--muted-2); font-weight: 700; padding: 10px 14px; border-bottom: 1px solid var(--border); background: var(--hover); }
        tbody td { padding: 10px 14px; border-top: 1px solid var(--border); color: var(--muted); vertical-align: top; }
        tbody tr:first-child td { border-top: none; }
        tbody td:first-child { color: var(--fg); font-weight: 600; white-space: nowrap; }
        .grid-2 { display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 16px; }
        @media (min-width: 640px) { .grid-2 { grid-template-columns: 1fr 1fr; } }
        .card { border-radius: 12px; border: 1px solid var(--border); padding: 18px; }
        .card h3 { margin: 0; }
        .card p { font-size: 14px; }
        .cta-row { margin-top: 24px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
        .bmc { display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 14px; border-radius: 10px; border: 1px solid #fde68a; background: #fffbeb; color: #92400e; font-size: 14px; font-weight: 600; }
        .bmc:hover { background: #fef3c7; }
        .note { margin-top: 20px; font-size: 13px; color: var(--muted-2); max-width: 760px; }
        footer { border-top: 1px solid var(--border); padding: 40px 0; margin-top: 56px; }
        .footer-inner { display: flex; flex-direction: column; gap: 12px; justify-content: space-between; }
        @media (min-width: 640px) { .footer-inner { flex-direction: row; align-items: center; } }
        .footer-note { font-size: 12px; color: var(--muted-2); }
        .footer-links { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; }
        .footer-links a { color: var(--muted); text-decoration: underline; text-underline-offset: 4px; }
"""

def faq_jsonld(faq):
    return json.dumps({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}}
            for q, a in faq
        ],
    }, indent=2)

def render(v):
    rows = "\n".join(
        f"""                            <tr><td>{dim}</td><td>{us}</td><td>{them}</td></tr>"""
        for dim, us, them in v["rows"]
    )
    faqs = "\n".join(
        f"""                <h3>{q}</h3>\n                <p>{a}</p>"""
        for q, a in v["faq"]
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{v["title"]}</title>
    <meta name="description" content="{v["desc"]}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="{BASE}/{v["slug"]}.html">
    <meta property="og:title" content="{v["title"]}">
    <meta property="og:description" content="{v["desc"]}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="{BASE}/{v["slug"]}.html">
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%20100%20100%27%3E%3Ctext%20y%3D%27.9em%27%20font-size%3D%2790%27%3E%F0%9F%91%81%EF%B8%8F%3C%2Ftext%3E%3C%2Fsvg%3E">
    <script type="application/ld+json">
{faq_jsonld(v["faq"])}
    </script>
    <style>{STYLE}    </style>
</head>
<body>
    <header>
        <div class="container header-inner">
            <a class="brand" href="./index.html">
                <div class="logo"><span>TP</span></div>
                <span class="brand-name">tinyproctor.js</span>
            </a>
            <details class="site-menu">
                <summary class="menu-toggle" aria-label="Open navigation">
                    <span></span>
                    <span></span>
                    <span></span>
                </summary>
                <nav aria-label="Primary navigation">
                    <a class="nav-link" href="./index.html#features">Features</a>
                    <a class="nav-link" href="./docs.html">Docs</a>
                    <a class="nav-link" href="./compare.html">Compare</a>
                    <a class="nav-link" href="./demo/exam.html">Demo</a>
                    <a class="btn btn-primary" href="https://github.com/tanzir71/tinyproctorjs">GitHub</a>
                </nav>
            </details>
        </div>
    </header>

    <main>
        <section class="container hero">
            <p class="pill"><span class="mono">comparison</span><span>tinyproctor.js vs {v["name"]}</span></p>
            <h1>{v["h1"]}</h1>
            <p class="lead">{v["desc"]}</p>
            <div class="cta-row">
                <a class="btn btn-primary" href="./demo/exam.html">Try the live demo</a>
                <a class="btn" href="./docs.html">Read the docs</a>
            </div>
        </section>

        <section class="container section">
            <h2>What {v["name"]} does</h2>
            <p>{v["what"]}</p>
            <h2 style="margin-top:28px;">How tinyproctor.js differs</h2>
            <p>{v["differs"]}</p>
        </section>

        <section class="container section">
            <h2>Side by side</h2>
            <div class="table-wrap">
                <table>
                    <thead><tr><th>Dimension</th><th>tinyproctor.js</th><th>{v["name"]}</th></tr></thead>
                    <tbody>
{rows}
                    </tbody>
                </table>
            </div>
            <p class="note">Comparison reflects publicly documented behavior as of June 2026 and typical configurations; vendor capabilities and pricing change — verify details with the vendor before purchasing.</p>
        </section>

        <section class="container section">
            <h2>Which should you choose?</h2>
            <div class="grid-2">
                <div class="card">
                    <h3>Choose {v["name"]} if…</h3>
                    <p>{v["choose_them"]}</p>
                </div>
                <div class="card">
                    <h3>Choose tinyproctor.js if…</h3>
                    <p>{v["choose_us"]}</p>
                </div>
            </div>
        </section>

        <section class="container section">
            <h2>Frequently asked questions</h2>
{faqs}
            <div class="cta-row">
                <a class="btn btn-primary" href="./demo/exam.html">See it work in 30 seconds</a>
                <a class="bmc" href="https://buymeacoffee.com/tanzir" rel="noopener">☕ Support this project</a>
            </div>
        </section>
    </main>

    <footer>
        <div class="container footer-inner">
            <div class="footer-note">tinyproctor.js — free &amp; open source. Built by <a href="https://tanziro.com" style="text-decoration:underline;">tanziro.com</a> · <a href="https://buymeacoffee.com/tanzir" style="text-decoration:underline;">Buy me a coffee</a></div>
            <div class="footer-links">
                <a href="./index.html">Home</a>
                <a href="./docs.html">Docs</a>
                <a href="./compare.html">Compare</a>
                <a href="./demo/exam.html">Demo</a>
                <a href="https://github.com/tanzir71/tinyproctorjs">GitHub</a>
            </div>
        </div>
    </footer>
    <script src="./site-menu.js"></script>
</body>
</html>
"""

for v in VENDORS:
    path = os.path.join(OUT, v["slug"] + ".html")
    with open(path, "w", encoding="utf-8") as f:
        f.write(render(v))
    print("wrote", path)
