# Life 3.0 editorial revision — October 2, 2026

This revision uses the supplied critique as editorial feedback. Claims and references were checked independently. It preserves the existing historical benchmark snapshot, timeline caveats, image assets and shared article layout.

## Added and rechecked references

- [Christiano et al.](https://arxiv.org/abs/1706.03741) and [Vaswani et al.](https://arxiv.org/abs/1706.03762): both initial submission dates are June 12, 2017. Proximity does not establish influence on the book.
- [InstructGPT paper](https://arxiv.org/abs/2203.02155): supports the continuation of human-feedback methods beyond the original experiments. The revision does not adopt the critique's claim that this thread remained merely an experimental patch.
- [Stanford, Canaries, August 2026 revision](https://digitaleconomy.stanford.edu/app/uploads/2026/08/Canaries_August2026.pdf), abstract: the article uses the updated comparison and preserves its observational qualifications. It is not an AI-caused unemployment rate.
- [OpenAI, April 29, 2025](https://openai.com/index/sycophancy-in-gpt-4o/) and [May 2 postmortem](https://openai.com/index/expanding-on-sycophancy/): company accounts of the GPT-4o rollback. They support a specific failure in reward selection and deployment review, not an assertion about the secret motives of all AI developers.
- [FTC, January 2025](https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-issues-staff-report-ai-partnerships-investments-study): historical partnership findings and potential competition concerns. No claim that all contracts are unchanged in October 2026 or that the report adjudicated illegality.
- [Moloch's filmmakers](https://owlinspace.com/moloch) and [FLI's September 29 episode](https://futureoflife.org/podcast/visualizing-moloch-a-short-film-about-the-ai-race-with-tom-cozens/): primary materials for the fictional scenario. The follow-up social revision verified Tegmark's October 1 post directly; see below. Engagement counts are not used as evidence.
- [DeepMind's AlphaEvolve report](https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/): rechecked the reported engineering contribution; broader competitive compounding is labeled analysis.
- [IEA, 2026](https://www.iea.org/reports/key-questions-on-energy-and-ai/executive-summary): rechecked the data-center totals and infrastructure constraints. Incumbent advantage is presented as an inference.

## Editorial and visual scope

The through-line is possible disempowerment through useful, obedient systems. No claim that displacement, concentration or self-improvement is inevitable. The new competition diagram is an analytical framework with alternative outcomes, not a quantitative forecast. New figure 08 shifts the subsequent figure numbers by one; all figures remain uniquely numbered 01–13.

## Social perspectives — October 2 follow-up

Read the following original public X pages in the browser, checking account, text and displayed date. Web text extraction of X was unreliable; the public browser pages supplied the verification. Video descriptions are attributed to the sharing account, not treated as independently transcribed video. No copied engagement counts or unsourced AGI milestones were added.

| Placement | Original post | Displayed date | Editorial treatment |
| --- | --- | --- | --- |
| Book introduction, inline | [Louis Gleeson](https://x.com/aigleeson/status/2066843394442432807) | June 16, 2026 | Reader interpretation about control and decisions before arrival. Do not adopt its claim that the book assumes AGI already arrived. Long post linked rather than allowed to overwhelm the article. |
| Scaling, embed | [vitrupo sharing Alexandr Wang](https://x.com/vitrupo/status/1918489901269479698) | May 2, 2025 | Attribution to the sharing account. The coding claim is not treated as a documented consensus forecast or proof of occupational replacement. Short fallback excerpt is from the post's quotation. |
| Work, embed | [Max Tegmark on Moloch](https://x.com/tegmark/status/2105674846499655882) | October 1, 2026 | Verifies the race-to-replace framing directly. Fictional film remains identified as fiction. |
| Timelines, embed | [Tsarathustra sharing Tegmark](https://x.com/tsarnick/status/1870566377721135557) | December 21, 2024 | Prediction markets separated from researcher surveys. Wartime-spending analogy not used quantitatively. Fallback is labeled a summary, not a quotation. |
| Infrastructure, inline | [Max Tegmark on direction](https://x.com/tegmark/status/2104667602484162889) | September 28, 2026 | Control-loss statement identified as his assessment rather than a verified technical milestone. |
| Before conclusion, embed | [Joscha Bach](https://x.com/Plinz/status/2103362997104295940) | September 24, 2026 | Hopeful perspective and respect across disagreement. The post does not identify a particular timeline disagreement, so none is attributed. |

Also read [Schmidhuber's June 21 post](https://x.com/SchmidhuberAI/status/2068702715555754059). Its specific historical priority claim would need a separate research discussion; it was not used as uncomplicated corroboration of the transformer history.

### Embed implementation

Official widgets.js and createTweet; see [X's developer example](https://blog.x.com/developer/en_us/topics/tips/2019/displaying-tweets-in-ios-apps). One shared script, viewport-based loading, no autoplay request, conversation hidden, dnt enabled, and theme matched to the page. No API token or new dependency. Server-rendered excerpts/summaries and direct source links survive disabled JavaScript, script blocking or unavailable posts. Failed/timed-out render targets detach to prevent late widgets replacing the fallback. The shared article banner and width rules are unchanged.

### Verification

- Final Astro build passed: 101 pages, October 2 at 18:08 local tool time.
- Embed script passed strict TypeScript diagnostics against the DOM libraries.
- All four original embeds loaded in the browser, including video previews; light/dark switching changed the iframe theme correctly.
- Desktop and 375/390-pixel mobile viewports checked. At 320 pixels, X's minimum frame width exceeded the available space; the component now shows its linked excerpt below a 300-pixel container width instead of clipping the post. The narrow fallback and normal mobile embed were verified after the final build.
- No browser warnings/errors in the final preview check. Desktop proof: `social-desktop-preview.png`.
