#!/usr/bin/env python3
"""Generates the per-vendor 'alternative' pages and holds the shared site chrome
(head, header, footer) used by every subpage. Run from the repo root:

    python3 build-alt-pages.py

then `npm run build` to mirror the result into docs/."""
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


# ---------------------------------------------------------------------------
# Shared site chrome. docs.html, compare.html and demo/exam.html use the same
# header and footer; keep them in sync with index.html.
# ---------------------------------------------------------------------------
LOGO = ('<svg class="logo" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">'
        '<g stroke="#14171c" stroke-width="1.5" stroke-linejoin="round">'
        '<path d="M16 4.5 26 10.27 16 16.04 6 10.27Z" fill="#6f84ff"/>'
        '<path d="M6 10.27 16 16.04V27.5L6 21.73Z" fill="#2540ff"/>'
        '<path d="M26 10.27 16 16.04V27.5L26 21.73Z" fill="#1726a8"/></g></svg>')
BRAND = LOGO + '<span class="brand-name">tinyproctor<span class="tld">.js</span></span>'
GITHUB = "https://github.com/tanzir71/tinyproctorjs"
CHANGELOG = GITHUB + "/blob/main/CHANGELOG.md"
COFFEE = "https://buymeacoffee.com/tanzir"
NAV = [
    ("What's new", "index.html#whats-new", None),
    ("Features", "index.html#features", None),
    ("Setup", "index.html#setup", None),
    ("Docs", "docs.html", "docs"),
    ("Compare", "compare.html", "compare"),
    ("Demo", "demo/exam.html", "demo"),
]
ALTS = [
    ("proctorio-alternative", "vs Proctorio", "No webcam, no extension, no vendor cloud — what you give up and what you gain."),
    ("honorlock-alternative", "vs Honorlock", "Per-session pricing vs free and self-hosted — when each model makes sense."),
    ("respondus-lockdown-browser-alternative", "vs Respondus LockDown", "Detection vs prevention, and why zero-install matters on exam day."),
    ("safe-exam-browser-alternative", "vs Safe Exam Browser", "Two open-source tools that solve opposite halves of the problem — and combine well."),
]


def head(prefix, title, desc, url, og_type="website", extra="", og_title=None, og_desc=None):
    og_title = og_title or title
    og_desc = og_desc or desc
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <meta name="description" content="{desc}">
    <meta name="robots" content="index, follow">
    <meta name="theme-color" content="#ffffff">
    <link rel="canonical" href="{url}">
    <meta property="og:title" content="{og_title}">
    <meta property="og:description" content="{og_desc}">
    <meta property="og:type" content="{og_type}">
    <meta property="og:url" content="{url}">
    <meta name="twitter:card" content="summary">
    <link rel="icon" type="image/svg+xml" href="{prefix}assets/favicon.svg">
    <link rel="preload" href="{prefix}assets/fonts/InstrumentSans-Bold.woff" as="font" type="font/woff" crossorigin>
    <link rel="stylesheet" href="{prefix}assets/site.css">{extra}
</head>
"""


def site_header(prefix, active=None):
    links = []
    for label, href, key in NAV:
        cur = ""
        if key and key == active:
            cur = ' aria-current="page"'
        elif key == "compare" and active == "alt":
            cur = ' aria-current="true"'
        links.append(f'                <a class="nav-link" href="{prefix}{href}"{cur}>{label}</a>')
    nav = "\n".join(links)
    return f"""<body>
    <a href="#content" class="sr-only skip">Skip to content</a>

    <header class="site-header">
        <div class="wrap header-inner">
            <a class="brand" href="{prefix}index.html" aria-label="tinyproctor.js home">{BRAND}</a>
            <details class="site-menu">
                <summary class="menu-toggle" aria-label="Open navigation" aria-controls="primary-nav"><span></span><span></span><span></span></summary>
            </details>
            <nav class="primary-nav" id="primary-nav" aria-label="Primary navigation">
{nav}
                <a class="btn btn-sm" href="{GITHUB}" target="_blank" rel="noopener">GitHub</a>
            </nav>
        </div>
    </header>
"""


def site_footer(prefix, scripts=""):
    alts = "\n".join(
        f'                        <li><a href="{prefix}{slug}.html">{label.replace(" LockDown", "")}</a></li>'
        for slug, label, _ in ALTS
    )
    return f"""
    <footer class="site-footer">
        <div class="wrap">
            <a class="donate" href="{COFFEE}" target="_blank" rel="noopener">
                <span class="donate-cup" aria-hidden="true">☕</span>
                <span class="donate-text"><strong>Tanzir Rahman</strong> is fueling open-source code, local utilities, and late-night builds.</span>
                <span class="donate-btn">Buy me a coffee</span>
            </a>
            <div class="footer-grid">
                <div class="footer-about">
                    <a class="brand" href="{prefix}index.html" aria-label="tinyproctor.js home">{BRAND}</a>
                    <p>Minimal, self-hosted, dependency-free browser integrity monitoring for online exams.</p>
                </div>
                <div>
                    <h4>Product</h4>
                    <ul>
                        <li><a href="{prefix}docs.html">Docs</a></li>
                        <li><a href="{prefix}demo/exam.html">Live demo</a></li>
                        <li><a href="{prefix}compare.html">Compare</a></li>
                        <li><a href="{prefix}llms.txt">llms.txt</a></li>
                        <li><a href="{CHANGELOG}" target="_blank" rel="noopener">Changelog</a></li>
                    </ul>
                </div>
                <div>
                    <h4>Alternatives</h4>
                    <ul>
{alts}
                    </ul>
                </div>
                <div>
                    <h4>Project</h4>
                    <ul>
                        <li><a href="{GITHUB}" target="_blank" rel="noopener">GitHub</a></li>
                        <li><a href="{COFFEE}" target="_blank" rel="noopener">Buy me a coffee</a></li>
                        <li><a href="https://tanziro.com" target="_blank" rel="noopener">tanziro.com</a></li>
                    </ul>
                </div>
            </div>
            <div class="footer-base">
                <span>tinyproctor.js — built by <a href="https://tanziro.com" target="_blank" rel="noopener">tanziro.com</a></span>
                <span>MIT licensed. Free for commercial use.</span>
            </div>
        </div>
    </footer>
{scripts}    <script src="{prefix}site-menu.js"></script>
</body>
</html>
"""


def vs_cards(prefix, current=None, heading_level=3):
    out = []
    for slug, label, blurb in ALTS:
        cur = ' aria-current="page"' if slug == current else ""
        cta = "You are here" if slug == current else "Read the comparison"
        out.append(f'                    <a href="{prefix}{slug}.html"{cur}><h{heading_level}>{label}</h{heading_level}><p>{blurb}</p><span>{cta}</span></a>')
    return '                <div class="vs">\n' + "\n".join(out) + "\n                </div>"


def closer(prefix, title, text, primary=("Try the live demo", "demo/exam.html"), secondary=("Read the docs", "docs.html")):
    return f"""
        <section class="support">
            <div class="wrap support-inner">
                <div>
                    <h2>{title}</h2>
                    <p>{text}</p>
                </div>
                <div class="cta-row">
                    <a class="btn solid" href="{prefix}{primary[1]}">{primary[0]}</a>
                    <a class="btn" href="{prefix}{secondary[1]}">{secondary[0]}</a>
                </div>
            </div>
        </section>"""


# ---------------------------------------------------------------------------
# Alternative pages
# ---------------------------------------------------------------------------
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
    url = f'{BASE}/{v["slug"]}.html'
    rows = "\n".join(
        f'                            <tr><th scope="row">{dim}</th><td class="us">{us}</td><td>{them}</td></tr>'
        for dim, us, them in v["rows"]
    )
    faqs = "\n".join(
        f"                    <details>\n                        <summary>{q}</summary>\n                        <p>{a}</p>\n                    </details>"
        for q, a in v["faq"]
    )
    ld = f'\n    <script type="application/ld+json">\n{faq_jsonld(v["faq"])}\n    </script>'
    return head("./", v["title"], v["desc"], url, "article", ld) + site_header("./", "alt") + f"""
    <main id="content">
        <section class="page-hero">
            <div class="wrap">
                <a class="crumb" href="./compare.html"><b>Compare</b>tinyproctor.js vs {v["name"]}</a>
                <h1>{v["h1"]}</h1>
                <p class="lead">{v["desc"]}</p>
                <div class="cta-row">
                    <a class="btn btn-primary" href="./demo/exam.html">Try the live demo</a>
                    <a class="btn" href="./docs.html">Read the docs</a>
                </div>
            </div>
        </section>

        <section class="section">
            <div class="wrap duo">
                <div class="card">
                    <span class="tag">{v["name"]}</span>
                    <h2>What {v["name"]} does</h2>
                    <p>{v["what"]}</p>
                </div>
                <div class="card accent">
                    <span class="tag brand">tinyproctor.js</span>
                    <h2>How tinyproctor.js differs</h2>
                    <p>{v["differs"]}</p>
                </div>
            </div>
        </section>

        <section class="section tint">
            <div class="wrap">
                <div class="section-head">
                    <h2>Side by side</h2>
                </div>
                <div class="table-scroll">
                    <table class="cmp">
                        <thead><tr><th scope="col">Dimension</th><th scope="col" class="us">tinyproctor.js</th><th scope="col">{v["name"]}</th></tr></thead>
                        <tbody>
{rows}
                        </tbody>
                    </table>
                </div>
                <p class="note">Comparison reflects publicly documented behavior as of June 2026 and typical configurations; vendor capabilities and pricing change — verify details with the vendor before purchasing.</p>
            </div>
        </section>

        <section class="section">
            <div class="wrap">
                <div class="section-head">
                    <h2>Which should you choose?</h2>
                </div>
                <div class="duo">
                    <div class="card">
                        <h3>Choose {v["name"]} if…</h3>
                        <p>{v["choose_them"]}</p>
                    </div>
                    <div class="card accent">
                        <h3>Choose tinyproctor.js if…</h3>
                        <p>{v["choose_us"]}</p>
                    </div>
                </div>
            </div>
        </section>

        <section class="section">
            <div class="wrap faq-layout">
                <div>
                    <h2>Frequently asked questions</h2>
                    <p class="sub">More answers in the <a class="text-link" href="./docs.html#faq">docs FAQ</a>.</p>
                </div>
                <div class="faq">
{faqs}
                </div>
            </div>
        </section>

        <section class="section tint">
            <div class="wrap">
                <div class="section-head split">
                    <div>
                        <h2>Other comparisons</h2>
                    </div>
                    <a class="text-link" href="./compare.html">See the full comparison matrix</a>
                </div>
{vs_cards("./", v["slug"])}
            </div>
        </section>
{closer("./", "See it work in 30 seconds", "Open the live demo, switch tabs or paste some text, and watch the integrity score react. It runs in your browser and nothing is uploaded.")}
    </main>
""" + site_footer("./")


if __name__ == "__main__":
    for v in VENDORS:
        path = os.path.join(OUT, v["slug"] + ".html")
        with open(path, "w", encoding="utf-8") as f:
            f.write(render(v))
        print("wrote", path)
