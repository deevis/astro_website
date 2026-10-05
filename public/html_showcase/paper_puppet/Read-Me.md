# Paper Puppet Playground

Extract the complete **Paper Puppet Playground ZIP** into a folder. On Windows, run **Start-Paper-Puppet.bat**; it uses Node.js or Python 3, whichever is installed. On Mac or Linux, run `node server.mjs` or `python3 server.py` in the extracted folder. The launcher opens a local browser page and serves only your own computer. Keep its window open while playing; Ctrl+C stops it. You can also host the folder on any static web server.

The download now has a small `index.html`, application JavaScript and CSS, and separate character images, backgrounds, obstacle sprites and audio under `assets/media/`. Keep the folder together. Opening `index.html` directly shows launch instructions because browsers restrict reading local media for Canvas and Web Audio. The local game needs no internet connection after extraction. YouTube backgrounds and online share links need internet. The hosted playground supports private saved shows; the local package uses show import/export.

## Deploy on your own host

Upload `index.html` and the entire `assets/` folder together to any static web host, preserving their relative paths. You can deploy at the domain root or in a folder. No server-side application, Node.js or Python runtime is needed on the host. The launcher scripts are only for local use. Replace the complete package when updating so a shared link and its character catalog use the same release. This v32 package includes Obama, Biden and Elon Musk as well as Haaland and Trump; older copies cannot resolve links that select characters added after that release.

## Play first, dance when you choose

The page opens in **Play** with **DadFunky** selected. Character selection, environments, Pose, Go limp and Show skeleton stay close to the stage. Dance and cast configuration only appear after you choose **Dance mode** or press **G**. Returning to Play hides those controls and keeps your cast setup for the next routine.

The six settings buttons open focused dialogs. Done, the close button or Escape returns keyboard focus to the stage. Settings apply immediately, except Text sequence edits, which take effect on its next start. The simulation keeps running unless you pause it.

| Dialog | Options |
| --- | --- |
| Physics | Gravity, pose editing/dropping, ragdoll and automatic stand-up |
| Trails | Enable trails, pick skeleton points, fade duration and clear paths |
| Obstacles | Choose/cycle obstacles and send one; sending closes the dialog |
| Sound | Enable/mute sound, music selection and separate music/effects levels |
| Video | Background tab for YouTube; Recording tab for clean view and OBS guidance |
| Models | Import a reusable puppet or export the selected model |

In Dance mode, Cast chooses who is available, Lineup & sizes opens ordering, visibility, size and name controls, Text sequence opens the animated message editor, Routine & emotes selects choreography and a featured dancer, and Shows & takes saves setups and records or replays performance cues. Close the dialogs to use performance hotkeys. Scene, sound, obstacle, pause, reset and clean-view shortcuts remain available in Play.

## Characters

Fourteen characters are ready in the character menu:

| Character | Reference and rig |
| --- | --- |
| **Moigletroy** | The original goth paper character, with red glasses, black hair and fishnet leggings. |
| **NatFerg** | The supplied frog-onesie photo, adapted into a neutral pose without the held ball or room. Green frog hood, white belly, mitten hands and gray socks. |
| **Penguino** | The supplied cropped penguin-onesie photo, reconstructed in a neutral pose. Low cartoon penguin hood with a yellow bill, visible smile, black fleece, white buttoned belly and inferred dark hiking shoes. Default dance size 1.00×. |
| **DadFunky** | The two supplied costume photos, adapted into a neutral pose. Oversized wild brown wig and mustache, open blue shirt, gray graphic tee, dark jeans and black socks. |
| **Naykaboom** | The three supplied outdoor photos, adapted into a neutral pose. Long brown hair, safety goggles, gray T-shirt, pink harness and belt, black trousers and brown hiking boots. |
| **Green Hero** | The two supplied green-costume photos, adapted into a neutral pose. Pointed green hood, white chest emblem, red shorts, blue-ribbon medal and black high-tops. Default dance size 1.00×. |
| **NayFuzzy** | The person in the brown teddy coat and straw hat in the two supplied store photos. Oversized fuzzy coat, olive cargo shorts, bare lower legs, striped black socks and inferred black sneakers. Default dance size 1.00×. |
| **Haaland** | The supplied front-facing full-body pose and football kit, with loose shoulder-length blond hair from the extra reference. Sky-blue shirt, white shorts, blue socks and lime boots. Default size 1.00×. |
| **Trump** | The supplied upright full-body photo. Navy suit, white shirt, red tie, gold-blond hair and polished black shoes. Default size 1.00×. |
| **Obama** | The supplied smiling portrait in a dark charcoal suit, white shirt, gray-blue tie and black dress shoes. Clasped hands adapted into a neutral pose. Default size 1.00×. |
| **Biden** | The supplied walking photo in a navy suit, vivid blue tie, white pocket square and black dress shoes. Adapted into a neutral pose. Default size 1.00×. |
| **Elon Musk** | Generated as requested: sunglasses, an open black leather jacket, black OCCUPY MARS T-shirt, dark jeans and black boots. Default size 1.00×. |
| **Martin** | The supplied hooded portrait, adapted into a neutral pose. Shaggy dark hair, raised charcoal hood, I AM / VERY GOOD lettering, dark jeans and simple black sneakers completing the cropped feet. |
| **Hamzah** | The supplied full-body photo, adapted into a neutral pose. Short dark curls, a dark NETTSPEND shirt, black-and-white checked trousers and bare feet. |

DadFunky is selected when the page opens. Choose **Obama**, **Biden**, **Elon Musk**, **Haaland**, **Trump**, **NayFuzzy**, **Penguino**, **Green Hero**, **Martin**, **Hamzah**, **Naykaboom**, **NatFerg** or **Moigletroy** from the menu to switch characters. All fourteen have 15 articulated joints and support walking, double jumps, throwing, automatic recovery, obstacles and rigid pose mode. Switching characters resets the current motion and clears any obstacle, while keeping the environment, gravity and sound preferences.

The default cast is **Moigletroy → NatFerg → Penguino → DadFunky**. Penguino replaces Naykaboom in this starting lineup. The picker order is Moigletroy, NatFerg, Penguino, DadFunky, Naykaboom, Green Hero, NayFuzzy, Haaland, Trump, Obama, Biden, Elon Musk, Martin, then Hamzah. All fourteen remain available in **Dance mode → Cast**, with up to six dancers in a routine. To replace a member of a full cast, uncheck one, check another, then choose **Apply cast**. Existing saved shows retain their original cast IDs and order.

Use **Show skeleton** to see the joints, or **Pose mode** to reposition them. Clothing is divided into rigid paper-like pieces that bend at the skeleton's joints. Naykaboom's pink chest gear follows the torso and the belt follows the hips. The large handheld blasters and shield were left out to keep both arms free. Hair and clothing move with their attached pieces; they do not simulate soft cloth.

DadFunky's wig and mustache are part of the head piece. His original pointing and leaning poses were reconstructed into a relaxed upright pose so both arms and legs can move independently. Use Pose mode to arrange a disco-pointing pose, then choose Drop pose to send the whole shape bouncing.

## Share a dance

In **Dance mode → Share dance**, choose the full current cast or only the focused dancer. The full-cast option preserves hidden members, their order, and their sizes. The solo option makes the chosen dancer visible at their current size. A share includes the routine, selected character, cast, scene, background scrolling, names, skeleton preference, trail settings, text, music and effects levels, and the video’s mute preference.

**Sound enabled** and **Start in fullscreen** default on. **Hide controls for the performance** defaults on and can be changed independently. If a video is the active background, enter its start offset in seconds, `m:ss`, or `h:mm:ss`. Playback begins there and loops back there; an offset beyond a known video duration falls back to the beginning. The full text sequence is encoded in the URL, including every line, zoom/hold/fade timing, text size and the threshold for moving in front of the dancers. The Share dialog previews the first three lines and shows the total line count. Enable **Start text with the dance** to play it after Start dance; otherwise the recipient can press **Y** to trigger those same lines later. Choose **Copy dance link**; when clipboard access is unavailable, select and copy the displayed link manually.

Opening a link prepares Dance mode silently, then shows **Start dance**. This click enables the selected audio and requests fullscreen. If fullscreen is unavailable, the dance continues in the browser window. YouTube may still request its own play click depending on browser or video restrictions. Scenery switching continues to reuse the existing video player. The imported offset also survives saved-show export/import.

Links share a starting setup, not a recorded cue take. For a recorded take or imported character artwork, use **Shows & takes → Export show**. Large text sequences may need shortening to fit a share link. Invalid or incomplete links show an error with a way back to the playground.

Share links use your deployment’s domain and folder, including a path such as `/games/paper-puppet/index.html`. When creating a link from the local launcher, enter the full **Published page URL** where recipients should open it. There is no fallback to a different hosted playground. The setup is compressed into the URL fragment, so sharing needs no account, database or sharing backend. Anyone who can load your hosted page can use its dance links; the link does not bypass access restrictions on a private host. Built-in character IDs remain unchanged, so earlier shows still load after the display-name changes.

## Play

| Action | Control |
| --- | --- |
| Dance mode | Choose Dance mode or press G to enter; choose Play or press G again to return to solo play |
| Record / finish a take | I in an active Dance routine; restarts from the count-in when beginning, finishes recording on the next press. During replay, I takes control |
| Solo emotes | In Dance mode: W waves, B bows, V celebrates, H shrugs; only the focused visible dancer performs the emote |
| Choose choreography | Dance mode → Routine & emotes: original Crew Groove, Disco Fever, or Robot Shuffle |
| Save / load a show | Dance mode → Shows & takes: save a setup or recorded performance, or export/import .show.json |
| Start / restart dance text | Y in Dance mode, or the play button beside Text sequence; one press plays the whole list once |
| Focus a dancer | In Dance mode, 1–6 (or numpad 1–6), or click their name; the first press leaves visibility unchanged |
| Show/hide a dancer | Press the focused dancer’s current number/name again; checkboxes toggle visibility directly |
| Resize a dancer | With a dancer focused, + or = increases size, − or _ decreases it; Shift does not matter. Numpad +/− and on-screen buttons also work, including while hidden |
| Reorder dancers | In dance mode, focus a visible dancer with 1–6, then left/right moves them one visible place, skipping hidden dancers and wrapping at either visible end; lineup up/down buttons reorder the full saved list |
| Dance arrow controls | Default or after S: left/right adjusts scenery scroll. After 1–6: move that dancer one visible place left/right, skipping hidden dancers and wrapping at either visible end |
| Next scene | S cycles Cemetery → Forest → Village → configured video (if present); never Original Studio |
| Character names | L or Character names switch; works in the clean recording view too |
| Music choice | Sound → Music: Environment music or Crew Groove; available during normal play |
| Clean recording view | C or Video → Recording → Clean recording view; C, Esc or double-click to return |
| Walk | Outside dance mode: hold A / D, left / right arrow, or the arrow buttons |
| Double jump | Tap Space / Jump, then tap again in midair for a stronger second jump; both recharge on landing |
| Arrange a pose | Pose button, Physics → Pose mode, or the bone icon above the stage; drag the joint dots |
| Move the whole pose | Drag the gold waist handle while editing |
| Drop the locked shape | Drop pose; gravity resumes and the shape bounces and spins as one rigid body |
| Adjust a locked pose | Edit pose; freezes it again for changes |
| Leave pose mode | Turn the Pose mode switch off or toggle the bone icon |
| Grab and throw | Press a body part, drag, and release with a flick |
| Collapse / recover | Go limp / Stand up; walking also restores posture |
| Automatic recovery | Auto stand-up switch; restores posture after 3 seconds |
| Send an obstacle | E or Send obstacle; uses the currently selected obstacle |
| Cycle obstacles | Q or the cycle icon: Wild boar → Erling Haaland → Bus |
| Toggle sound | M or Enable sound / speaker icon |
| Adjust audio | Open Sound; separate sliders for music and effects |
| Scroll the scenery | Play: walking automatically builds scrolling speed. Dance mode: Background scroll below the stage controls direction/speed; center or Stop holds still |
| Toggle motion trails | T, including during Play, Dance and clean recording; selected points and fade duration are retained |
| YouTube background | Video → Background → paste a video URL or ID → Use video background; separate video mute control |
| Change scenery | Environment menu: Moonlit Cemetery, Haunted Forest, Clover Village or Original Studio |
| Change gravity | Physics → Gravity slider, from 0× to 2× Earth gravity |
| See the rig | Show skeleton |
| Pause | P or the pause icon |
| Reset / restart | R or the reset icon; restarts the count-in during the group dance |
| Enlarge the stage | Fullscreen icon, where supported |

The character becomes a ragdoll after a throw or an obstacle impact. **Auto stand-up** is on by default: after 3 seconds, the skeleton recovers its standing posture. Holding the puppet restarts the timer on release; pausing freezes it. Each new impact restarts the delay. Switch Auto stand-up off to remain floppy, or choose **Stand up** / start walking to recover sooner. The elbows flex and the forearms trail the upper arms as you walk. The arms and hands always appear in front of the body and legs. Clicking an overlapping arm grabs the visible arm. Paper parts can still fold across each other; this is a layer priority rule, not rigid self-collision. The original studio has walls; the three illustrated environments let you walk endlessly in either direction while the camera follows. The camera now follows high jumps vertically; the floor stays solid, and a distant upper boundary keeps zero-gravity throws within reach. It is a playful approximation of physics, rather than an engineering simulator.

## Show presets, cue recordings and solo emotes

**Crew Groove** remains the original default routine. In **Dance mode → Routine & emotes**, choose **Disco Fever** for bigger points, rolling arms and side grooves, or **Robot Shuffle** for mechanical pops, box arms and a traveling wave. All three keep the existing 112 BPM soundtrack, four-beat count-in and 64-beat loop. Switching routines keeps the current beat.

Focus a visible dancer using their current **1–6** key, or choose **Featured dancer** in Routine & emotes. With no explicit focus, the selected solo character is featured when it is in the cast; otherwise the first visible member is used. Only that character performs the emote, blending in and then returning to the group choreography. The other dancers continue their routine. Hidden characters stay hidden.

| Emote | Key |
| --- | --- |
| Hello there / wave | W |
| Take a bow | B |
| Victory! | V |
| Who, me? / shrug | H |

Customize emote **duration (1–8 seconds)** and **energy (50–150%)**. Defaults are 3 seconds and 100%. Emotes pause with the dance, survive a lineup reorder, and clear on restarting the routine. Close settings before using hotkeys; typing, sliders and dialogs keep their normal keys. These emotes are available in Dance mode, including a cast with just one dancer.

### Keep a setup

Open **Shows & takes** and enter a show name. Under **Current setup**, **Save new** creates a private saved show on the hosted playground. Each save creates a separate entry. **Export** downloads a `.show.json` file that can be imported into the hosted or standalone playground.

A setup contains the selected character, ordered cast, visibility and sizes, group routine, emote options, scenery or YouTube ID and mute preference, dance scroll speed, names, skeleton display, trail settings, text settings, sound preferences and volume levels. Custom character assets used by the show are included. Saved setups open in Dance mode; loading one starts a fresh count-in. Loading does not automatically replay an imported performance.

The hosted **Saved shows** list supports Load and confirmed Delete. Shows are private to the signed-in account and survive browser sessions. The local package has no cloud-save controls: **Export a show file to keep it, then Import it in another session.** Shows are limited to 24 MB; the hosted list supports up to 100 entries. Exports can be kept separately without that entry limit.

### Record and replay a performance

1. Set up the cast, routine, scene, sound and effects. Enter Dance mode and start a routine.
2. Press **I**, or open Shows & takes and choose **Record take**. The routine and music restart from the four-count intro, trails and active text/emotes clear, and cue recording begins.
3. Perform using the existing controls: change scenes or scroll speed, hide/show or reorder dancers, change sizes or routine, toggle trails, trigger text, or perform solo emotes. Changes from controls and hotkeys are captured.
4. Press **I** again or **Finish / stop** to finish. The take retains its original setup and the recorded changes with their dance-clock times.
5. In Shows & takes choose **Replay take**. The starting setup is restored, assets are prepared, the count-in starts again, and the recorded changes play once. Completion pauses at the end. Replay can be started again.
6. Under **Recorded performance**, **Save new** or **Export** keeps the starting setup and cues together. **Current setup** saves only the current configuration, without attaching the prior take.

**P** pauses the dance and cue clock. Hidden tabs also freeze the clock. During replay, stage changes are locked; **I / Take control** stops replay. **C** still opens clean view. Leaving Dance mode or restarting the routine finishes an active take. Starting another recording replaces the current unsaved take, so save or export a good one first. The maximum is **10 minutes or 1,500 cues**, whichever comes first. The expandable cue list shows recorded times and actions.

Cue recordings are performance instructions, **not video or audio files**. Capture the replay in clean view with OBS or your preferred capture software for a movie. The app's dance and music use the same clock; a YouTube ID and mute setting are saved, but the external video's playback position is not synchronized to the take. Optional YouTube backgrounds still require a hosted/web-served page and internet. A file opened directly from disk uses the saved illustrated scenery instead.

## Motion trails

1. Press **T** to turn trails on or off, or open **Trails** and use **Leave motion trails**. Trails are off initially, with both hands and feet preselected. Holding T does not repeatedly toggle them.
2. Click points on the skeleton preview or use their named checkboxes. All 20 rig anchors are available, including hands, feet and the top of the head. **Hands & feet**, **All** and **None** provide quick selections. Left/right refer to the character's own sides.
3. Choose a **Fade duration** from **0.5 to 10 seconds**; the default is **3 seconds**.
4. Close the panel, then drag, throw, walk, jump, pose or dance. Soft pink, cyan and gold paths follow the chosen points and fade away.

**Show skeleton** is independent: switch it off to see the character and trails without bones or joint dots. Trails also appear in the clean recording view and over a configured video background. In Dance mode, the selected points apply to every visible dancer. Focusing a dancer changes which character appears in the trail picker preview.

**T** works in Play, Dance and clean recording, even with the skeleton hidden. It preserves your selected points and fade duration. Like other performance hotkeys, it leaves typing and settings dialogs alone.

Pausing freezes both motion and fading. **Clear trails** removes existing paths while keeping the settings. Switching trails off clears the paths; turning them on starts fresh ones. Reset, character or scene changes, a resize that changes the stage width, and dance ordering/visibility/size changes clear paths to prevent lines connecting unrelated positions. Trail histories are bounded by their duration and sample limit.

## Group choreography

Choose **Dance mode**, then open **Cast** to choose up to **six loaded characters**, then select **Apply cast**. The picker includes built-in and imported models. Cancel leaves the current cast unchanged. Remaining members keep their order; newly selected members join the end. A removed member’s size and show/hide setting are remembered if you add them back. If you remove the focused dancer, the arrow keys return to scenery scrolling.

Open **Lineup & sizes** to see cast controls; close the dialog to use performance hotkeys. Only cast members appear under **Dance lineup**. Cast membership chooses who is available; the lineup checkboxes and number keys control visibility during the performance. Number keys match the current slots, from 1 up to the cast size; unused number keys have no effect. **1–6** (including the numeric keypad) first focus the character in that slot without changing visibility. Press the same character’s current number again to toggle them on/off. Clicking their name follows the same rule; checkboxes toggle visibility directly. Choosing a different character only changes focus. Focus follows the character through reordering, so their new number toggles them; their old number focuses whoever now occupies that slot. Every cast member may be hidden while the routine and music continue. Applying an empty cast also keeps an ongoing routine and its music running. To start a new dance, choose at least one cast member. Cast changes preserve the current beat, music and pause state.

Use each row’s **up/down buttons** to reorder the chosen slots, including hidden dancers. The numbers follow the current order, **left to right**, with the **top row first** on narrow stages. Visibility and size stay attached to each character through reordering. Changes preserve the current beat, music and pause state.

In dance mode, **left/right arrow keys** have two contexts:

| Most recent context shortcut | Left arrow | Right arrow |
| --- | --- | --- |
| Default, or **S** | Decrease scenery scroll by 5 percentage points | Increase scenery scroll by 5 percentage points |
| **1–6** | Move that dancer one visible place left; first visible wraps to last visible | Move that dancer one visible place right; last visible wraps to first visible |

Hold an arrow to repeat scrolling or dancer moves. Scroll is clamped to −100…100; zero stops it. In dancer context, arrows swap the selected visible dancer with the next visible neighbor, skipping hidden dancers. Moving left from the first visible position places that dancer last and shifts the other visible dancers one place left; moving right from the last visible position does the reverse. Hidden dancers keep their exact saved slots in the numbered list, and everyone keeps their size and visibility. Selection follows the same dancer through each move. With only one visible dancer, arrows leave the order unchanged. A focused hidden dancer stays in place until shown again; their size controls still work, and the lineup up/down buttons can prepare their saved position. **S** advances the scene, clears dancer focus and returns the arrows to scrolling. Other commands, such as L, M or P, leave the arrow context unchanged. The active dancer row and the hint above the stage show what the arrows will control. Number keys and dancer resizing are active only after choosing Dance mode. Outside dance mode, arrows retain their walking behavior.

With a dancer focused, **+** or **=** increases their dance size; **−** or **_** decreases it. Shift does not matter, and the numeric keypad +/− keys also work. Hold a size key to repeat. The size changes in **5% steps, from 25% to 200%**; the starting values are **Moigletroy 103% (1.03×)**, **Naykaboom 110% (1.10×)**, **DadFunky 120% (1.20×)**, **NatFerg 100% (1.00×)**, **Hamzah 101% (1.01×)** and **Martin 100% (1.00×)**. Manual +/− adjustments start from those values. The percentage and smaller/larger buttons appear below the lineup. You can resize hidden dancers or prepare their sizes before starting the dance. Sizes follow each character through hiding, reordering, pausing and restarting during this page session. Resizing keeps their feet anchored to the dance floor and leaves the joint rig and song timing intact.

Press **L** to toggle the dancers’ name labels, or use **Character names** below the lineup. It works while paused and in the clean recording view. Entering the clean view initially hides labels; L can then explicitly show them. These shortcuts ignore text fields, menus, sliders and browser modifier combinations. Holding a number, S or L does not repeatedly toggle it.

Press **G**, choose **Dance mode** above the character menu, or use the music-note icon above the stage. This reveals Cast, Lineup & sizes and Text sequence and starts the chosen routine. If the cast is empty, choose cast members, then **Start routine**. Choose Play or press G to leave Dance mode, including while the cast is empty. The chosen lineup performs independently of the selected solo character. A four-beat count-in leads into eight eight-beat phrases: step-clap, disco points, side shuffle, a wave down the line, knee pops, double hops, robot arms and a group finish. The 64-beat routine loops at **112 BPM** (about 34 seconds per repeat).

Press **M** to enable the original **Crew Groove** score. The animation follows the music clock, and enabling sound midway joins the current beat. **P** pauses/resumes everyone and the soundtrack; **R** restarts from the four-count intro; **G** or **Stop dance** returns to the selected character, standing and ready for normal physics. On-screen buttons provide the same actions.

Only visible dancers occupy stage positions, in their saved lineup order. One stands in the center; two stand equally to either side of center; with three, the middle dancer is centered. Four use one row on wide stages and two centered rows on narrow stages. Five use one centered row on wide stages; narrow stages use three in the upper row and two in the lower row, with both rows centered. Six use a centered row on wide stages and two centered rows of three on narrow stages. Hiding or showing a dancer recenters the visible group without restarting the choreography or music. The formation fits itself to the stage width and visible count; each dancer’s chosen size is applied on top of that fitted size. The current move, eight-count beat markers and routine progress appear above the stage. Environment changes, skeleton display, fullscreen and audio levels still work. Walking, throwing, pose editing and obstacles resume when the dance stops. Choosing a different character also ends the routine; environment, gravity and auto stand-up settings are kept. Imported models remain available for solo play and appear in the Cast picker. Choose up to six loaded characters for the lineup; its visibility controls can show any subset, including none. The lineup is retained while switching play modes, for this page session.

The score is synthesized from original percussion, bass, chords and melody; it uses no external recordings. It is included in the downloaded package with the choreography.

## Dance text sequence

Enter **Dance mode**, open **Text sequence**, and put one message on each line. The three sample messages can be replaced with your own. Blank lines are skipped, and long lines shrink to fit the stage. Press **Y** from the stage, use the small play button beside Text sequence, or choose **Start sequence** in the dialog. The dialog closes when starting so the stage stays visible.

One press plays the complete list once. Each line first appears very small and faint high in the scene, then grows and moves downward until its visible lettering is vertically centered. It remains horizontally centered throughout. At **85% of its zoom time**, it moves from behind **all** dancers to in front of them; this point is configurable.

| Setting | Default | Range |
| --- | --- | --- |
| Zoom time | 3 seconds | 0.5–10 seconds |
| Hold at full size | 2 seconds | 0–20 seconds |
| Fade time | 1 second | 0.1–5 seconds, up to the selected zoom time |
| Move in front at | 85% of zoom | 0–100%; 0 starts in front, 100 waits until full size |
| Full text size | 10.5% of stage height | 4–20%; long lines shrink to fit |

The hold timer begins **after** the line reaches full size and the center. Once the hold ends, that line stays centered and fades while the next line begins its journey from above. The fade finishes before the next line reaches full size, so only two messages can overlap. The final line also fades, then the sequence stops.

Press **Y** again to restart from the first line. Holding the key does not keep restarting it. Editing text or settings prepares the next start without interrupting the current sequence. **Stop text** in the dialog clears the active messages and keeps your configuration. **P** and tab visibility pause text alongside the scene. Resetting the routine or leaving Dance mode clears active text; scene changes, cast changes, hiding dancers and resizing preserve the text timeline. An ongoing routine with every dancer hidden can still show text.

Text is painted into the same canvas as the dancers, so it appears over YouTube backgrounds and in **clean recording view** and OBS captures. It does not require music to be enabled. Y is inactive in Play, and all typing fields, dialogs and browser modifier shortcuts keep their own keys. Text configuration is retained during the current page session.

## Explore the environments

- **Moonlit Cemetery:** a violet night sky, crooked gravestones, iron fences and a chapel.
- **Haunted Forest:** twisted trees, blue mist, roots and glowing mushrooms.
- **Clover Village:** a cheerful cartoon countryside with fruit trees, cottages and flowers.
- **Original Studio:** the first enclosed physics stage.

**In Play**, hold A/D, a left/right arrow, or an on-screen walk button. The scenery moves past in the opposite direction, starting slowly and building speed over **four seconds** to a comfortable maximum. Reversing direction starts gently again; releasing the walk controls eases the scenery to a stop. An idle, posed or collapsed character does not build walking speed.

**In Dance mode**, **Background scroll** appears below the stage and directly controls horizontal scenery motion. The center is completely still; move slightly left or right for a slow drift, and farther outward for progressively faster movement. The Stop button returns the slider to center without jumping the scenery back to the start. Distant scenery moves slowly, middle scenery moves faster, and nearby plants move faster still. The ground texture moves at full speed. The original studio’s grid also scrolls.

The manual slider is hidden and inactive in Play. Its chosen speed is remembered and resumes when you enter Dance mode again, including while setting up an empty cast. Walking speed builds afresh when you return to Play. A YouTube background plays normally and is never translated by either scroll behavior. Pause or hiding the tab freezes scrolling; the layers loop in both directions. Switching scenes, characters or resetting a puppet clears the walking build-up while retaining the saved dance scroll setting. The camera follows high jumps upward and returns to the ground view as you land. While you hold a body part or arrange a pose, the camera stays still so the grab tracks your pointer.

**S** cycles **Moonlit Cemetery → Haunted Forest → Clover Village → YouTube video**, then back to the cemetery. The video stop appears only after you configure one. **Original Studio is never included in this shortcut cycle**, though it remains in the manual environment menu. Switching scenes does not restart the dance. Scenery arrow adjustments do not change YouTube playback; they are retained for the next illustrated scene.

All three environments are included as separate image files in the downloaded package. They load from the local folder as you select scenes; no external image service is used.

## YouTube video backgrounds

Open **Video → Background**, paste a YouTube URL or its 11-character video ID, then choose **Use video background**. Standard watch URLs, shortened youtu.be links, Shorts, live-video links and embed URLs are accepted. The video loops behind the characters in solo play or group dance.

Every newly selected video starts **muted**. Use **Mute video** or the **Video muted / Video sound on** button below the stage to toggle its audio. This is separate from **M**, which controls the playground’s own music and sound effects. Pause and tab visibility also pause the video; resuming continues playback. If the browser blocks playback, a **Play video** button appears.

Choose **Use scenery** to return to the illustrated environment and its scroll slider. Your configured video is remembered for **S**, the environment menu, or **Show configured video**. Its player stays loaded, at full stage size, and **continues playing silently beneath the illustrated scenery**. Switching back reveals the ongoing video and restores your chosen video mute setting. Scene changes no longer send pause/play commands, removing that source of the play/pause-control flash. Explicitly pausing the playground or hiding the browser tab still pauses the player. YouTube controls remain disabled through the supported embed setting; network buffering and YouTube-managed messages are outside the playground’s control. **Forget video** removes it from the scene cycle. The slider controls the illustrations; YouTube runs its own looping playback. Loading errors provide Retry and Use scenery actions, and invalid URLs leave the current background unchanged.

YouTube requires an internet connection and a video whose owner permits embedding. Private, deleted or blocked videos show an explanation. Use the online playground or the included local launcher for video playback. Video files are streamed by YouTube and are not stored in the download. See [YouTube’s player parameters](https://developers.google.com/youtube/player_parameters) and [embedded-player error reference](https://developers.google.com/youtube/iframe_api_reference#Events).

## Record a clean video

You do **not** need a Windows application. The browser already renders the scene; an external recorder can capture the complete composition and its digital audio. The playground now includes a recording view, but it does not encode or save a video by itself.

1. Open the [online playground](https://paper-puppet-playground.polymer.chatgpt.site) in a separate Chrome or Edge window. Set the background, dancers, order and music. Press **M** to enable the soundtrack. Leave **Mute video** on if you want only Crew Groove and the playground’s effects.
2. Choose **Video → Recording → Clean recording view**, or press **C**. It fills the screen where fullscreen is supported, with a **16:9 stage**. Other screen shapes have black margins. Controls, dancer labels, skeleton guides and pointer hints disappear initially. Press **L** if you want the dancer labels in your recording. **C**, **Esc** or a double-click returns to the controls. The animation, music, video and pause state continue without restarting. G, P, R, M, S, 1–6, L and the contextual arrow shortcuts still work; a keyboard-focusable exit button is also available.
3. In [OBS Studio](https://obsproject.com/), add **Window Capture** and select this browser window. Disable **Capture Cursor**. Check the preview to make sure it shows the whole scene. Window Capture targets that window even when another window is in front of it. Keep the playground tab open and avoid minimizing it: this app intentionally pauses music and choreography when the document is hidden. See [OBS Window Capture](https://obsproject.com/kb/window-capture-sources).
4. Enable **Capture Audio (BETA)** on that source if available. Alternatively add **Application Audio Capture** for the browser. Use one of these audio routes, and disable global **Desktop Audio** so the same sound is not recorded twice. Disable **Mic/Aux** unless you want commentary, and silence other browser tabs. You are recording the application’s digital sound, not a microphone listening to your speakers. Check that OBS’s audio meter moves. These capture options are documented in the [OBS application audio guide](https://obsproject.com/kb/application-audio-capture-guide).
5. Use the settings below, record a short test, then watch and listen to the saved file before a longer take. Start OBS recording before the performance, return to the playground and press **R** for the four-count dance intro. Trim the lead-in afterward. R restarts choreography and Crew Groove; it does not rewind the independent YouTube background.

Suggested starting settings for a crisp recording:

| Setting | Starting point |
| --- | --- |
| OBS base canvas and output | **1920 × 1080**, both the same |
| Frame rate | **60 fps** for the puppet motion |
| Source size | Capture the stage at 1080p or larger; avoid enlarging a small preview. Crop any black margins before fitting it to the OBS canvas. |
| Video encoder | Hardware H.264 if available; for NVIDIA or AMD, **CQP 18** is a useful starting point. Intel uses ICQ; x264 uses CRF. |
| Audio | **48 kHz stereo**, AAC at **320 kbps**, with the meter staying out of the red |
| Recording format | **MKV**, then **File → Remux Recordings** to make an MP4 for editing/upload |

CQP 18 is a suggested choice within OBS’s documented 16–23 range; lower values improve quality and increase file size. Simple output mode is also supported if you prefer its quality presets. Use the encoder options your computer exposes. See the [OBS encoder settings guide](https://obsproject.com/kb/advanced-recording-settings-guide). OBS recommends MKV and provides built-in MP4 remuxing; remuxing changes the container without another video encode. See the [recording output guide](https://obsproject.com/kb/standard-recording-output-guide).

A 1440p or 4K capture is useful when the browser is genuinely rendering at that size and the computer can sustain the frame rate. Upscaling a small capture cannot recreate detail. The character artwork and background source quality also limit how much real detail is available. Recording and YouTube processing can introduce compression; digital application audio avoids room noise and speaker/microphone coloration, but does not recover detail missing from the original score.

OBS records the **assembled browser view**, so the embedded YouTube picture is included. A simple canvas-only export would miss that separate player. A future direct-export feature could render every frame at a chosen resolution and mix the music offline using a supplied local background video. That can be built as an export workflow without turning the entire playground into a Windows app. It is not part of this update. The clean view does not alter YouTube’s own player overlays or availability.

## Double jump and pose mode

**Double jump:** tap Space or the Jump button once to take off, then again in midair for a stronger upward boost. Only one extra air jump is available; holding Space does not spend it automatically. Both jumps recharge on landing. Delaying the second tap gives more total height, while an early second tap helps clear an approaching bus or Haaland. The stage follows upward so the old ceiling no longer cuts the jump short. Gravity still affects jump height.

**Pose mode:** choose Pose in the play controls, Physics → Pose mode, or the bone icon above the stage. The skeleton freezes in its current position with gravity suspended. Green dots let you bend its connected parts; the gold dot at the waist moves the entire character. Drag an elbow to swing an arm, a wrist to bend that elbow, a knee to swing a leg, or an ankle to bend a knee. The extra dots at the head, hands and boots turn those pieces. Chest and pelvis handles rotate their connected groups. Bone lengths stay fixed.

Choose **Drop pose** to lock the complete shape and restore gravity. It behaves as one rigid object: it can fall, bounce, rotate, settle, be grabbed and thrown, or be launched by an obstacle. Auto stand-up waits while the pose is locked. If gravity was set to zero, Drop pose restores 1× gravity; afterward, the gravity slider remains available.

Choose **Edit pose** to freeze the current shape again. Entering the editor clears any passing obstacle so you can arrange the joints without an interruption; obstacles become available after dropping the pose. Turn **Pose mode** off to return to ragdoll movement and normal walk/jump controls. Auto stand-up resumes if enabled. Reset exits pose mode and restores the original standing character. Pose changes are temporary and do not rewrite the downloaded model file.

## Send an obstacle

Choose **Wild boar**, **Erling Haaland**, or **Bus**, then press **E** or **Send obstacle**. Press **Q** to cycle through the choices; cycling changes the next obstacle without interrupting the current pass. Holding a shortcut does not send repeated obstacles. Shortcuts work from the play area, including fullscreen; open menus and editable fields keep their own keyboard controls. The boar and Haaland run through the scene with animated strides; the bus drives through. A hit sends the puppet upward and sideways into a connected ragdoll tumble. Passes alternate between left and right, and only one obstacle can cross at a time. Each pass delivers a single impact. The boar has a forgiving collision region around its charging snout, so a well-timed jump can dodge it. The bus is 20% smaller and Haaland 30% smaller than the previous version, while both travel much faster. Their collision checks include the limb segments between joints, making them almost impossible to clear with a normal jump. A well-timed double jump can now clear either one. Start early: smaller windows leave less warning before an obstacle arrives. Collision height follows the smaller obstacle; neither uses an invisible full-height wall.

Pause freezes the obstacle and puppet together. Reset clears the active obstacle and returns the puppet to its start. The camera follows the thrown puppet through the scrolling environments. All obstacle artwork is included in the downloaded package as separate sprite files.

## Music and sound effects

Press **M** or choose **Enable sound** once to start audio. Each environment has its own original instrumental score:

| Environment | Music |
| --- | --- |
| Moonlit Cemetery | Slow bells, low organ-like chords and a distant breeze |
| Haunted Forest | Hollow wooden mallets, misty drones and long echoes |
| Clover Village | Cheerful marimba, a skipping bass and light percussion |
| Original Studio | Soft electric piano and warm sustained chords |

**Sound → Music** selects **Environment music** or **Crew Groove · 112 BPM** for walking, jumping, ragdoll and pose modes. Crew Groove skips the count-in during normal play and keeps looping across scenery changes. The dance routine always uses its synchronized score; during a dance the selector is labeled **Music after dance**. Selecting Crew Groove keeps the song playing when the dance stops; selecting Environment music brings back the current scene’s score. Changing this preference during a routine does not interrupt the routine.

Environment music loops continuously and crossfades when you change environments. In **Sound**, use the separate Music volume and Sound effects sliders to balance the score and effects. Zero music volume keeps obstacle sounds available; M mutes everything.

The boar has hoofbeats and a grunt, Haaland has quick footsteps and a rushing sprint sound, and the bus has engine noise and a horn. Sounds pan from side to side and get louder as the obstacle approaches. A rising warning plays shortly before a likely collision, followed by a thump and paper-like rustle on impact. Each approach and hit plays its cue once.

Pausing the simulation or hiding the tab suspends audio. Reset clears current obstacle sounds while keeping the selected music. During the group dance, Reset restarts both choreography and its count-in instead. All scores and effects are included as separate MP3 files in the downloaded package and load on demand from its local server.

## Load more models

**NayFuzzy.puppet.json**, **Penguino.puppet.json**, **Green-Hero.puppet.json**, **Martin.puppet.json**, **Hamzah.puppet.json**, **DadFunky.puppet.json**, **Naykaboom.puppet.json**, **NatFerg.puppet.json** and **Moigletroy.puppet.json** are complete reusable character files. Each contains the embedded transparent artwork, part outlines, hinge coordinates and collision settings. Open **Models** and choose **Save [character name]** to export the current model; **Load .puppet.json** imports another one.

Choose **Load model** and select a compatible `.puppet.json` file. It appears in the character selector for this browsing session. Keep the model files on your computer to load them again later. Model files are read in your browser; there is no server upload.

An ordinary photograph is not a rig file. For a new character, prepare a transparent front-view drawing, outline its pieces and position its joints. Version 1 supports the same humanoid arrangement as this original: 16 rigid pieces, 15 articulated hinges and 5 virtual endpoints. The image can be different and the proportions can change. Support for different arrangements can be added later.

## Model format, version 1

The `.puppet.json` file itself is the working template. Coordinates use the embedded image's pixels: x increases to the right, y downwards. `.R` and `.L` mean the character's own right and left.

| Field | Meaning |
| --- | --- |
| `format`, `version` | Must be `paper-puppet` and `1` |
| `id`, `name` | Unique lowercase ID (letters, digits, `_` or `-`) and display name |
| `sourceSize` | `[imageWidth, imageHeight]`, 64–4096 pixels per side |
| `bounds` | `[left, top, right, bottom]` around the character |
| `image` | Embedded PNG, JPEG or WebP data URL; PNG with alpha is preferred |
| `nodes` | Each named node is `[x, y, collisionRadius, mass]` |
| `pivots` | The 15 visible hinge names |
| `pieces` | 16 objects with `id`, endpoints `a`/`b`, and a pixel-coordinate `polygon` |
| `braces` | Structural torso constraints; rebuilt by the loader to preserve the solid pieces |

Keep the same node names, piece IDs and endpoint connections as the template. Polygons should cover their part of the artwork, with some overlap at hinges. The order of `pieces` is the drawing order for the body and legs. The playground always draws the upper arms, forearms and hands afterward, on top, even if the imported file lists them earlier. Node radii approximate collisions. Each rigid image piece turns around its endpoints without stretching its drawing. All files are limited to 12 MB.

The original has neck, two torso/waist hinges, paired shoulders, elbows, wrists, hips, knees and ankles. The ankles were estimated from the reference. Additional tip nodes orient the head, hands and boots. The art is an isolated rendition of the supplied photo; the articulated joints were placed manually.

## Current scope

This version starts in a compact single-character Play mode with focused settings dialogs and fading joint trails. It provides fourteen built-in characters, a Cast picker for up to six loaded characters, a synchronized dance with reorderable cast slots and independently toggleable visibility, contextual arrow controls, scene and name shortcuts, Crew Groove available in normal modes, a clean 16:9 recording view, walking, double jumping with vertical camera follow, a joint pose editor and rigid pose drops, pointer dragging and throwing, optional automatic ragdoll recovery, three moving obstacles with keyboard controls, scene music and spatial sound effects, adjustable gravity, collisions, a skeleton overlay, a reusable character loader, three illustrated parallax environments with independent direction/speed control, and optional looping YouTube backgrounds with a separate mute control. Arms and hands stay on the front layer. The pose editor changes the existing skeleton; there is no artwork or rig-topology editor, saved animation timeline, automatic photo rigging or Blender connection in this page.

## NatFerg artwork preparation

The built-in image generator adapted the supplied photo into a transparent, front-facing cutout. The ball and background were removed, the hidden clothing and empty mittens were reconstructed, and the arms were lowered and separated for rigging. The PNG pixels are embedded unchanged in NatFerg's model. Joint positions and all 16 piece outlines were mapped manually; no automatic anatomy tracking is involved. The original photograph was preserved.

The image preparation prompt was:

> Create a full-body, front-facing photographic cutout of the woman in the reference, preserving her recognizable face, gentle smile, brown eyes, long dark hair, green fleece frog onesie, raised frog eyes on the hood, white belly, green mitten-covered hands and pale gray knitted socks. Remove the frog ball completely and remove the room. Reconstruct the hidden torso and empty hands. Use a relaxed A-pose with arms lowered about 20 degrees outward, nearly straight elbows, clear gaps between arms and torso, and slightly separated legs and feet. Keep the hair inside the head and torso silhouette. Show the full hood and feet with margins, on actual transparent alpha, without a floor, cast shadow, outline, text, guides or bones. Preserve realistic fleece and knit textures.

## Naykaboom artwork preparation

The built-in image generator used all three supplied photographs: the closer front-facing photo for face and proportions, the original photo for the pink harness and magazine holders, and the far-right person in the group photo for supporting outfit and boot detail. The result is a reconstructed photographic cutout in a neutral A-pose. The large handheld blasters and shield are omitted; the pink harness, belt, magazines and green side pouch remain. The PNG pixels are embedded unchanged. Fifteen hinges and sixteen piece outlines were mapped manually for the existing walking, ragdoll and pose controls. All original photographs were preserved.

The image preparation prompt was:

> Use case: photorealistic-natural / identity-preserving character reference.
> Asset type: ONE transparent photographic full-body puppet cutout for the Paper Puppet Playground website.
> Primary request: Create one 1024x1536 portrait RGBA PNG with an ACTUAL transparent alpha background, containing only Naykaboom, the same person shown in the supplied references. Preserve recognizable facial likeness, age, natural body proportions, and natural photographic appearance.
> 
> Input images and roles:
> - Image 1 (20250816_112015.jpg): Naykaboom is the central foreground person with long brown hair, clear safety goggles, gray short-sleeve T-shirt, bright pink diagonal shoulder strap, pink chest foam-dart magazine holders, bright pink waist belt, black trousers, and brown hiking boots. Use this as the main costume reference. Do not copy the hand-over-mouth pose or the large gray shield.
> - Image 2 (00c67206-a2f2-4de4-8b8c-60bfd1a8bbfc.png): Naykaboom is the front and center person with long brown hair and clear safety goggles with a dark upper rim. This is the PRIMARY face, likeness, and body-proportion reference. Preserve the face and natural physique. Use its brown lace-up hiking boots, black trousers, pink waist belt/pouches, and green side pouch. Do not copy the held green toy blaster.
> - Image 3 (20250719_124652.jpg): Naykaboom is the FAR-RIGHT long-haired person with goggles and pink gear. Use only as supporting outfit and boot reference. Do not include any of the other people.
> 
> Subject and costume: Naykaboom, full head and all hair through both boot soles visible. Long natural brown hair around shoulders, clear safety goggles with black upper rim, plain medium-gray short-sleeve T-shirt, bright pink diagonal harness crossing the torso with pink chest magazine holders containing bright toy foam-dart magazines, bright pink waist belt and pouches, one green side pouch, plain black trousers, brown lace-up hiking boots. Keep the observed real fabric, hair, skin, and boot textures.
> 
> Composition and pose: Centered, straight-on front view at natural eye level. Relaxed upright stance, neutral comfortable expression. A neutral A-pose: both upper arms held about 15–20 degrees away from the torso; elbows, bare forearms, wrists, and empty hands visible and distinct. Hands hang comfortably away from hips and thighs, with transparent gaps between each arm and the body. Feet hip-width apart with a clear transparent gap between legs and boots. Both legs naturally straight, both boots fully visible, toes mostly forward. Anatomically correct hands and naturally proportioned limbs. Leave a modest transparent margin around the complete silhouette. Keep costume equipment close to the torso so wrists, elbows, hips, and knees remain visually unobstructed for puppet articulation.
> 
> Scene/backdrop: Genuine transparency everywhere outside the person, including all gaps between limbs. No floor, ground, environment, painted background, gray background, checkerboard pattern, cast shadow, or contact shadow.
> Lighting/style: Soft even photographic lighting, natural color, realistic photography, clean detailed cutout edges including hair. No illustration, cartooning, 3D plastic look, stylization, or beauty transformation.
> 
> Hard constraints: Exactly one person and one image. Empty hands. Omit all held toy blasters and the large shield. Do not invent weapons or a shooting pose. Keep goggles and distinctive pink foam-dart costume gear. No text, labels, watermark, border, skeleton overlay, hinge marks, diagram, joints drawn onto the image, extra objects, or other people. Output must be a true transparent RGBA PNG.

## DadFunky artwork preparation

The built-in image generator used both supplied costume photographs. The closer image guides the face, wig, mustache and shirt details, while the full-body image guides the tall proportions and outfit. The leaning and pointing poses were reconstructed into a front-facing relaxed A-pose with separated hands and feet. The open blue checker-pattern shirt, gray Snoopy graphic tee, dark jeans and black socks remain. The wig and mustache move together with the head; the shirt is divided across the torso and hip pieces. The PNG pixels are embedded unchanged. Fifteen hinges and sixteen piece outlines were mapped manually. Both original photographs were preserved.

The image preparation prompt was:

> Use case: identity-preserve
> Asset type: photographic full-body articulated paper-puppet source cutout, character name DadFunky.
> Primary request: Create exactly ONE portrait 1024x1536 RGBA PNG with genuine transparent alpha outside the complete person and through the spaces between his arms, torso, hands, and legs. Reconstruct the SAME recognizable tall, lean adult man shown in both reference photos in a straight-on upright neutral A-pose.
> Input images: Image 1 (/workspace/scratch/7d3eeade7ac6/upload/PXL_20201031_220846519.jpg) is the full-body reference for proportions, complete outfit, costume wig silhouette, jeans, and black socks. Image 2 (/workspace/scratch/7d3eeade7ac6/upload/PXL_20201031_220841002.MP.jpg) is the closer reference for recognizable face, age, huge comical costume mustache, wild hair, and shirt details. Use these as identity and clothing references, not as poses to preserve.
> Subject and invariants: Same real adult man's recognizable face and age, long lean natural body proportions, enormous mischievous swept/spiky dark brown costume wig with all wild tips visible, thick bushy dark brown fake mustache. Keep the complete same outfit: open deep blue short-sleeve subtle checker-pattern overshirt; gray T-shirt with the retro Snoopy skateboard, palms, yellow/orange sunset graphic and "LIVIN' EASY" lettering as the references allow; dark charcoal/black jeans; black socked feet. Shirt stays open and its graphic remains visible. Preserve natural realistic face, hands, skin, fabric, and hair texture.
> Pose and framing: Straight-on eye-level full-body view, torso and head upright facing the viewer, relaxed neutral friendly expression. Arms descend around 15–20 degrees away from the torso with slightly relaxed elbows. Both empty hands and relaxed fingers are fully visible and clearly separated from hips and clothing, with open transparent gaps for future puppet joints. Legs straight and naturally relaxed; feet hip width apart with full black socks and all toe/sole ends visible, separate from one another. Complete wig tips through both socked feet in frame, centered with small transparent margins. Do not shorten the legs or broaden the body.
> Style and lighting: Photorealistic photographic cutout of the reference man, not a drawing, toy, rendered 3D model, or stylized character. Soft even neutral studio photo lighting, remove the room's colored lighting cast while retaining realistic texture and color.
> Transparency and exclusions: Actual PNG alpha transparency; do not paint a checkerboard or any solid background. No room, walls, doors, floor, surface, cast shadow, other people, added objects, shoes, boots, accessories, labels, title text, puppet bones, handles, joint circles, overlays, border, or watermark. The original tee graphic and its lettering are part of his outfit and should remain. One single complete person only.


## Hamzah artwork preparation

Hamzah was reconstructed from the supplied `slushy_noobz-hamzah.jpg` as a front-facing neutral cutout. The original photo is unchanged. The generated 1024 × 1536 RGBA PNG is embedded unchanged in the reusable model; its silhouette is divided with manually traced polygons into 16 pieces around 15 articulated joints. Curly hair and the smiling face follow the head, the shirt lettering follows the chest, and the checked trousers split at the hips and knees. The hands are empty and the feet remain bare. **Show skeleton** and **Pose mode** expose the rig. Hamzah starts at **1.01×** in the dance lineup, initially slot **5**; DadFunky now starts at **1.20×**.

One image was generated using the supplied photo for identity and clothing and the existing DadFunky cutout for presentation and pose only. No additional variants were generated. The image-generation request was:

> Use case: identity-preserve and background-extraction.
> Create ONE 1024 x 1536 portrait PNG image: a realistic photo cutout of the person in reference image 1, for a two-dimensional paper puppet rig.
>
> Input images: Image 1 is the edit target and sole identity and clothing reference, a smiling young adult male with short dark curls in an oversized charcoal tee and checkered pajama trousers. Image 2 is ONLY the desired realistic full-body cutout presentation and mild A-pose reference. Do not copy the second person's identity, hair, face, clothing, shoes, or dark glow.
>
> Preserve the exact facial likeness, warm smile with visible teeth, face proportions, warm medium skin tone, short thick dark curly hair and slim body of image 1. Preserve the dark charcoal oversized short-sleeve T-shirt with large white slightly distressed lettering that reads exactly "NETTSPEND", and loose black-and-white small-check pajama trousers. Bare feet. The whole curly head and every toe must be inside the frame, with generous clean margins.
>
> Repose him into a straight, relaxed front-facing symmetrical mild A-pose: head and torso upright, shoulders level, each arm straight and angled about 15–20 degrees outward from the body, elbows straight; hands empty with fingers together in a natural relaxed shape; a visible open gap between each hand/forearm and the body. Legs slightly apart with clear separation down both trouser legs; both knees straight; bare feet angled slightly outward and fully visible. Maintain realistic anatomy and original body proportions.
>
> Output one isolated character centered on a genuinely transparent alpha background. If true alpha is unavailable, use a uniform plain very pale gray background. Natural soft even photographic illumination, realistic fabric folds and skin texture, clean detailed silhouette including curls and toes. No room, no props, no object in either hand, no ground, no ground shadow, no cast glow, no labels, no guides, no joints, no frame. Do not crop hair, hands, or feet. Do not stylize into a cartoon, painting or 3D render.


## Martin artwork preparation

Martin uses the supplied `thatkidmartin.jpg` for face, raised hood, hairstyle, I AM / VERY GOOD lettering and dark jeans. The reference crops the feet, so the neutral-pose cutout completes the lower legs with plain black low-top sneakers. A single 1024 × 1536 RGBA image was generated. The image bytes are embedded unchanged in the reusable model, with 16 manually traced pieces, 20 physics nodes and 15 articulated joints. The hood and hair move with the head, the lettering with the chest, and the long sleeves bend at the elbows. Martin starts at **1.00×** and is initially the sixth cast member.

Generation provenance:

```json
{
  "tool": "image_gen__imagegen",
  "mode": "built-in",
  "requests": 1,
  "prompt": "Use case: identity-preserve.\nAsset type: one full-body photographic character cutout for an articulated paper-puppet web app.\nInput images: Image 1 is the identity and clothing reference for Martin and is the person to reproduce. Image 2 is only a supporting pose/framing reference: use its front-facing full-body stance and mild A-pose. Do not use Image 2's identity, face, hair, skin tone, expression, clothing, feet, background, or glow.\nPrimary request: Create exactly one realistic photographic cutout of Martin from Image 1, in a clean front-facing full-body mild A-pose. Preserve his recognizable facial identity, slim young-adult body proportions, pale light skin, straight shaggy dark hair, and neutral slightly open-mouth expression. Keep the dark charcoal hood UP framing his face, with the face clearly visible. Keep the same dark charcoal pullover hoodie with front kangaroo pocket, cuffs, hem, seams, and off-white chest lettering in two centered lines: first line exactly \"I AM\", second line exactly \"VERY GOOD\". Preserve the narrow distressed serif style and generous letter size of the reference. Keep his dark blue-black jeans with realistic denim texture and folds.\nPose/completion: Arms straight and angled about 15–20 degrees out from the torso, with clear transparent gaps between arms and torso. Hands empty and relaxed with fingers together, fully visible. Legs slightly apart with a clear gap, knees straight. The source photo crops the feet; naturally complete the lower legs and add simple plain black low-top sneakers, with no logos, proportionate to his slim body.\nComposition/framing: One centered person, straight-on eye-level camera without perspective exaggeration. Complete hood, hair, hands, lower legs, and both shoes all inside the frame, with small clean margins. Aim for a 1024 by 1536 pixel portrait RGBA PNG.\nStyle/medium: Real photography with natural skin texture, realistic fabric and folds, neutral even frontal illumination, consistent with a photo cutout. Preserve Image 1's identity rather than beautifying or changing his features. Do not make a cartoon, painting, illustration, doll, or 3D render.\nScene/backdrop: Genuinely transparent alpha background everywhere outside the person, including between arms and torso and between legs. Crisp natural cutout edges, no baked checkerboard.\nAvoid: brick wall, room, furniture, props, floor, ground shadow, cast shadow outside the body, glow, halo, gradients, solid background, joints, labels, extra text, frames, borders, duplicate people, cropped body parts.",
  "referenced_image_paths": [
    "/workspace/scratch/7d3eeade7ac6/upload/thatkidmartin.jpg",
    "/workspace/scratch/7d3eeade7ac6/hamzah-assets/hamzah-full-body.png"
  ],
  "requested_dimensions": [
    1024,
    1536
  ],
  "output_path": "/workspace/scratch/7d3eeade7ac6/martin-assets/martin-full-body.png",
  "raw_output_path": "/workspace/scratch/7d3eeade7ac6/generated_images/exec-140228fd-1f10-459b-9986-e53496fdc5f9.png",
  "actual_dimensions": [
    1024,
    1536
  ],
  "mode_of_saved_png": "RGBA",
  "alpha_preserved_without_modification": true,
  "alpha_extrema": [
    0,
    254
  ],
  "fully_transparent_pixels": 1144003,
  "partly_transparent_pixels": 428861,
  "fully_opaque_pixels": 0,
  "notes": "Original generated PNG copied byte-for-byte to project asset handoff directory. No image edits, retries, or variants. Exact model, seed, and quality controls were not exposed by the built-in tool."
}
```

## Green Hero artwork preparation

Added from `IMG_20161031_084333 (1).jpg` and `IMG_20161031_084726.jpg`. **Green Hero** is a temporary display name, with a default dance size of **1.00×**. The standing reference supplies the medal and black high-tops; both photos guide the face and costume. The costume was reconstructed into a gentle A-pose for independent limb movement. The pointed hood follows the head, the blue ribbon and medal follow the chest, and the red shorts are divided between the pelvis and thighs. This is a photographic interpretation of the references rather than an exact pixel cutout.

One image was generated using the **built-in imagegen tool**, with no variants or retries. The 1024 × 1536 RGBA PNG is embedded byte-for-byte, including its original alpha, in `Green-Hero.puppet.json`. Its workspace path is `/workspace/scratch/7d3eeade7ac6/character-assets/green-hero-neutral.png`. Sixteen piece polygons, twenty physics nodes, and fifteen visible joints were mapped manually against that image. The original reference photos remain unchanged. The preparation script is `scripts/prepare-green-hero.py` in the project source.

The exact generation prompt was:

```text
Use case: identity-preserve.
Asset type: one photographic full-body character cutout for an articulated 2D photo puppet.
Input images: Image 1 (IMG_20161031_084726.jpg) is the primary reference for the exact person's face, natural body proportions, standing outfit, blue-ribbon medal, and black shoes. Image 2 (IMG_20161031_084333 (1).jpg) supports the same person's facial likeness, bright green costume, hood, and chest emblem. These depict the same subject; preserve their recognizable visible likeness without adding or changing their identity.

Create ONE full-body photographic cutout of this same person in a straight-on frontal neutral gentle A-pose. Head, shoulders, hips, and torso upright, level, and facing camera. Preserve the expressive wide eyes and slight closed-mouth smile. Arms extend gently diagonally downward about 25 degrees away from the body, with clear transparent gaps between each arm/hand and the torso; elbows and wrists natural and nearly straight. Hands exposed, relaxed with fingers together. Both legs nearly straight and slightly spread, with a clear continuous transparent gap between the legs below the shorts. Feet and black lace-up high-top shoes fully visible, separate, and facing approximately forward. This pose is for later 2D rigging, so no crossed limbs, no foreshortening, and nothing covering hands, shoulders, knees, or shoes.

Preserve the reference outfit exactly: close-fitting bright emerald green full-body fabric costume, tall pointed soft green hood around the face, white circular chest emblem with dark rim, red/magenta shorts worn over the green suit, exposed hands, round medal on a royal-blue ribbon hanging from the neck as in Image 1, and black lace-up high-top shoes. Preserve realistic skin, fabric texture, natural folds, costume seams, and natural proportions. The chest emblem and medal remain distinct, with the medal hanging lower.

Style/lighting: natural photorealistic photography, clear evenly lit face and clothing, faithful to the reference photographs, not an illustration or cartoon. Composition: portrait 1024x1536, entire person from tip of tall hood to soles of both shoes centered with generous transparent margin on every side. Person occupies about 90% of canvas height. Genuinely transparent alpha background, including all spaces between limbs. No room, floor, props, cast shadow, extra people, text overlay, labels, joint marks, border, or watermark. Produce only this single isolated person.
```

Verification included image decoding, artwork coverage, walking, double jumping, throwing and auto-recovery, all three routines at stage widths from 330 to 1920 pixels, all four solo emotes, live cast substitution, hidden resizing, saved-show round trips, and the unchanged DadFunky/Play startup. Native Canvas renders of the joints, dancing, and group lineup were visually inspected. Browser click-through testing was not performed for this update.

## Penguino artwork preparation

Added from the single cropped photo `IMG_20180125_130710.jpg`. **Penguino** starts at **1.00×**. The oversized hood stays low over the human eyes, preserving the visible smile, white cartoon penguin face and yellow bill. The black fleece, white buttoned belly panel and exposed hands follow the reference. The hidden limbs and cropped lower legs are reconstructed; the dark hiking shoes with tan laces are inferred from the small footwear fragment at the bottom of the photo. The backpack was omitted to leave the shoulders and arms clear. These reconstructed regions are an interpretation, not recovered photographic detail.

One **built-in imagegen** request produced a 1024 × 1536 RGBA cutout. Its PNG bytes and original alpha are embedded unchanged in `Penguino.puppet.json`; no variants, retries, or raster edits were used. The workspace image is `/workspace/scratch/7d3eeade7ac6/penguin-assets/penguin-neutral.png`, SHA-256 `5382e2ea87788b461b0ef865284553332b815b1f79addbe53a7208612c391785`. The original photo remains unchanged. `scripts/prepare-penguin.py` defines 16 manually traced rigid pieces, 20 physics nodes and 15 visible joints. Rounded sleeve overlaps keep elbows connected during bending; the lower belly stays on the pelvis while the legs move separately.

The exact generation prompt was:

```text
Use case: identity-preserve
Asset type: one photographic full-body puppet cutout, neutral source asset for an articulated rig.
Input image 1: the reference for the main foreground person, their visible lower-face likeness, penguin fleece costume, proportions, and textile texture.

Create exactly one person from the main foreground subject in the reference, isolated on a genuinely transparent alpha background. Preserve the visible lower-face likeness, light skin, and slight toothy smile. The oversized black penguin hood must stay pulled very low exactly as in the reference: white cartoon penguin face panels, black oval penguin eyes with small white highlights, and a prominent yellow bill. The hood and yellow bill obscure the HUMAN EYES and upper face. Do not lift the hood; do not invent or reveal human eyes. Head upright and front facing.

Use the same baggy black fleece penguin onesie, black long sleeves and legs, the reference's elongated light gray-white central belly panel with white buttons, and exposed human hands. Omit the backpack for an unobstructed articulated figure. Reconstruct the lower legs and feet cropped by the reference using plausible matching black onesie trousers and simple dark hiking shoes with subdued tan laces inspired by the footwear fragment along the reference's bottom edge.

Pose and composition: full front-facing upright gentle A-pose, level shoulders and level hips. Arms almost straight, gently diagonally down 20 to 25 degrees away from the torso, with clear transparent gaps between arms/hands and torso. Relaxed hands with fingers close. Legs slightly apart with a clear transparent gap and both separated feet fully visible. Retain the source's baggy fleece proportions rather than making a tight suit. Portrait 1024 by 1536 desired. Entire hood through shoes in frame with generous transparent margins at all sides.

Style: natural photographic human and fleece texture, soft even daylight illumination and realistic clothing folds. This is a photo-derived person, not a cartoon, figurine, illustration or stylized puppet. No other people, street, fence, bag, handheld items, props, labels, text, watermarks, joint marks, cast shadow, ground or floor. Background must be actual empty transparent alpha, never a painted checkerboard or white background.
```

Verification covered walking, double jumps, tossing and auto-recovery, all three routines and responsive cast formations, four isolated emotes, cast replacement and hidden resizing. Saved-show validation includes both Penguino and Green Hero. Native Canvas renders of standing joints, walking and dancing were visually inspected; browser click-through testing was not performed for this update.

## NayFuzzy artwork preparation

Added from `IMG_20190816_172403 (1).jpg` and `IMG_20190816_172358 (1).jpg`, using the person on the right in the fuzzy brown coat and straw hat. **NayFuzzy** starts at **1.00×**. The tan woven hat, caramel teddy-fleece double-breasted coat, olive cargo shorts, bare lower legs, and black socks with gold stripes follow the references. The cropped shoes were completed as plain black sneakers. The neutral pose and hidden regions are a photographic interpretation, not recovered photographic detail. The second person and store were excluded.

One **built-in imagegen** request produced a 1024 × 1536 RGBA cutout. Its PNG bytes and original alpha are embedded unchanged in `NayFuzzy.puppet.json`; no variants, retries, or raster edits were used. The workspace image is `/workspace/scratch/7d3eeade7ac6/fuzzy-funk-assets/fuzzy-funk-neutral.png`, SHA-256 `6a9e6e4c7343845f6607cefe9881a96c9ea31dbbcebe569be3302c28edb2c79c`. The original photos remain unchanged. `scripts/prepare-fuzzy-funk.py` defines 16 manually traced rigid pieces, 20 physics nodes and 15 visible joints. Rounded sleeve overlaps connect the elbows. The long coat hem follows the pelvis and draws in front of the moving shorts and legs, with the arms in front of the coat.

The exact generation prompt was:

```text
Use case: identity-preserve / background-extraction.
Asset type: one full-body photographic human cutout for later 2D puppet rigging.
Primary request: Create exactly ONE neutral-pose cutout of the person on the RIGHT in BOTH reference photographs, the person wearing the brown fuzzy coat and straw hat. Use reference image 1 as the primary guide for facial identity and the full visible outfit, and reference image 2 as supporting evidence for face and coat detail. Do not depict the person on the left.
Identity and anatomy: Preserve the right person's visible likeness, youthful slim natural body proportions, short straight dark fringe, ears and facial shape, and subtle relaxed closed-mouth smile. Keep the same apparent age and natural appearance; no glamour styling. This must look like a real photographic cutout of that person, never a cartoon, 3D render, doll, or physical toy.
Outfit: Tan woven straw fedora/trilby hat matching the references. Oversized warm caramel/rust-brown curly teddy-fleece double-breasted coat with its bulky silhouette, thick raised collar and lapels, large dark buttons, natural folds, and fuzzy edges. Coat hem reaches the mid/lower thigh. A faint glimpse of red-and-white striped tee at the neck. Olive green cargo shorts extend a little below the coat hem and end above the knees. Bare lower legs, black crew socks with thin gold/orange stripes near the top. The shoes are cropped in the references, so reconstruct simple plain black low-top sneakers without logos. Hands fully exposed and naturally relaxed.
Pose and framing: Full frontal upright gentle A-pose. Head, shoulders and hips level, facing the camera. Arms nearly straight and gently diagonal downward away from the torso, enough separation to leave CLEAR transparent gaps along both fuzzy sleeves and around both hands. Relaxed fingers, normal hands. Legs slightly apart, feet separate and facing almost forward. Entire hat, body, hands, legs, shoes and soles must fit inside the image with generous transparent margins. Center the single figure on a portrait 1024x1536 canvas.
Photography: Match the natural realistic texture and unglamorous photographic character of the input photos. Preserve realistic skin, cloth folds and dense curly teddy fleece; soft even photographic lighting.
Background and exclusions: Genuinely transparent alpha background, including all gaps between limbs and torso and between legs. No store, no second person, no furniture, no floor, no cast shadow, no scenery, no background color, no labels, no text, no joint markers, no watermark. The deliverable is exactly one complete photographic human figure.
```

Verification covered walking, double jumps, tossing and auto-recovery, all three routines and responsive formations from one to six dancers, all four isolated emotes, cast replacement, hidden resizing, and saved-show round trips. Native Canvas renders of the joints, walking and dancing were visually inspected. The startup remains DadFunky in Play mode. Browser click-through testing was not performed for this update.

## Asset packaging update

The media extraction preserves every source image and audio byte from v27. Built-in rig coordinates and articulation are unchanged. Packaged media is loaded from `assets/media/characters`, `backgrounds`, `obstacles`, and `audio`. Reusable `.puppet.json` exports still embed their character image so they can be imported on another computer. Original generation prompts above describe the source artwork and remain part of its provenance.

Verification for this update includes compressed share-link round trips, invalid-link limits, one-dancer selection, sound/fullscreen activation order, video offsets, all 28 media files served over HTTP, the new four-person formation, ordinary Play startup, existing audio controls, and saved-show compatibility. Native Canvas renders were inspected. A full browser click-through and Windows launcher execution were not available in this environment.


## v30 — Haaland, Trump, and independent hosting

Two new built-in characters are available in Play and the Cast picker: **Haaland** and **Trump**, both at default dance size **1.00×**. The original four-person cast and DadFunky startup remain unchanged; Martin and Hamzah remain the final two picker entries. Haaland’s playable rig is separate from the existing sprinting obstacle.

Each new character uses 16 manually traced rigid pieces, 20 physics nodes and 15 articulated joints. The full-body references guide their standing pose, face, proportions and clothes. Haaland’s loose shoulder-length blond hair comes from the additional hair reference and moves with the head. Trump’s jacket panels and sleeves are separated for movement; clothing is not soft-body cloth. These are generated photographic interpretations of the references.

The existing URL format already encoded text. This release makes it explicit in the Share dialog, previews its lines, and preserves its zoom, hold, fade, size and front-layer threshold even when automatic text playback is off. Press Y to start it manually. Links remain on your own domain and folder; the local launcher asks for your Published page URL instead of redirecting to the original private playground. No account or share backend is required.

Verification: both new rigs passed walking, double jumping, throwing, automatic recovery, all three routines, all four emotes, cast replacement, hidden resizing and formation fit checks. Native Canvas standing/joint/dance renders were inspected. Traced-piece coverage was 99.926% for Haaland and 99.987% for Trump. All 30 media files loaded over HTTP, and the original 28 retained their exact bytes. Share round trips preserved both new character IDs, Unicode multiline text, timing, video offsets, sound and fullscreen settings. TypeScript checks passed. A full browser click-through and native Windows launcher run were not available here.

### New character artwork provenance

Both 1024×1536 RGBA images were made with the built-in image_gen tool, one request each, without retries or post-generation raster edits. Original PNG bytes and alpha were preserved in the separate image assets and reusable model exports.

**haaland-full-body.png** — SHA-256 `b65aabc92b57563c854c97658c6e86463f22af62ba2f893ddafb5696b629f95f`.

Final generation prompt:

```text
Use case: identity-preserve. Asset: one full-body transparent raster character cutout for an articulated 2D paper puppet game.
Edit/reference image 1 supplies Erling Haaland's recognizable face, athletic body, front-facing upright standing posture and complete Manchester City kit. Reference image 2 supplies ONLY the loose long blond hair on the LARGE MAIN person: shoulder-length, swept back, untied; ignore the small inset entirely.
Make a single realistic photo-inspired person centered on a portrait 1024x1536 canvas. Wear the sky blue football shirt with maroon/white collar and cuffs, white shorts, blue knee socks and lime boots from image 1. Preserve athletic proportions and recognizable face. Replace the tied hairstyle with the loose swept-back shoulder-length blond hairstyle from the main person in image 2.
Upright front view, straight legs slightly apart with a clear transparent gap. Arms relaxed down at sides but modestly angled away from torso, leaving a clean visible transparent gap from each forearm/hand to torso and shorts. Hands empty, natural distinct fingers. Entire head, hair, hands and both shoes visible, small safe margins above and below.
Actual transparent background and crisp silhouette. Neutral even photographic lighting restricted to the person. No floor, scenery, cast shadow, glow, halo, backdrop, border, caption or watermark. Do not include any additional people, inset, sprite sheet, separated floating body parts, skeleton or rig lines. Output one complete connected full-body person.
```

**trump-full-body.png** — SHA-256 `ea2d235afdfbcc31364c9eee8d0b15f81c3803b3dffa65de1ca7e0651b37044b`.

Final generation prompt:

```text
Use case: identity-preserve. Asset: one full-body transparent raster character cutout for an articulated 2D paper puppet game.
Edit/reference image 1 supplies Donald Trump's recognizable identity, outfit, stockier body proportions and stern neutral facial expression. Render a single realistic photo-inspired person centered on a portrait 1024x1536 canvas.
Preserve recognizable face, gold-blond combed hairstyle, navy suit jacket and dark suit trousers, white shirt, long red tie and polished black shoes as in the supplied full-body reference. Front-facing upright standing posture, straight legs slightly apart with a clear transparent gap. Keep stockier natural proportions.
Arms relaxed down at sides but modestly angled away from torso, leaving a clean visible transparent gap from each forearm/hand to jacket and trousers. Hands empty with natural distinct fingers. Entire head, hands and both shoes visible, small safe margins above and below.
Actual transparent background and crisp silhouette. Neutral even photographic lighting restricted to the person. No crowd, stage, floor, scenery, cast shadow, glow, halo, backdrop, border, caption or watermark. Do not include any additional people, sprite sheet, separated floating body parts, skeleton or rig lines. Output one complete connected full-body person.
```


## v31 — Obama, Biden and Elon Musk

Three new built-in characters are available in Play and the Cast picker: **Obama**, **Biden**, and **Elon Musk**, all at default dance size **1.00×**. The catalog now has fourteen characters. The starting four-person cast and DadFunky startup remain the same; Martin and Hamzah are still the final two picker entries. The three new IDs also work in shared links, saved shows and recorded takes.

Obama’s charcoal suit, smiling face and gray-blue tie follow the supplied photo. Biden’s navy suit, vivid blue tie, white pocket square and flag pin follow his supplied walking photo. Their original poses were reconstructed as neutral standing poses with separated arms and empty hands. Elon wears the requested sunglasses, open black leather jacket and readable **OCCUPY MARS** T-shirt, with dark jeans and black boots. These are generated photographic interpretations, not extracted or recovered photographic detail.

Each new character has 16 manually traced rigid pieces, 20 physics nodes and 15 articulated joints. Jacket bodies follow the torso and hips, sleeves follow the arms, and hands remain above the body. Elon’s shirt lettering is kept together on the chest piece. PNG pixels and generated alpha are preserved byte-for-byte. The reusable `Obama.puppet.json`, `Biden.puppet.json` and `Elon-Musk.puppet.json` exports embed the same image bytes. `scripts/prepare-obama-biden-elon.py` contains the joint and piece definitions.

Verification covered all three characters walking, double jumping, being tossed, recovering automatically, performing each of the three dance routines and all four isolated emotes, fitting one-to-six-person formations, cast substitution and hidden resizing. Native Canvas renders of their standing joints and dance poses were visually inspected. Traced-piece coverage was 99.913% for Obama, 99.930% for Biden and 99.886% for Elon Musk. Sharing round trips include the new IDs alongside Haaland and Trump. All 33 media files loaded over HTTP; the original 28 retained their exact v27 bytes. Ordinary Play startup and TypeScript checks passed. The portable build was checked through its Node launcher and under a nested hosting path. A full browser click-through and native Windows launcher run were not available here.

### New character artwork provenance

Three built-in `image_gen.imagegen` requests produced one 1024×1536 RGBA image per character, with no retries, variants or post-generation raster edits. Obama used `Screenshot 2026-10-03 232301.png`; Biden used `Screenshot 2026-10-03 232510.png`; Elon used the requested outfit description without an uploaded reference.

**obama-full-body.png** — SHA-256 `6cbd320fadeaab5d789bd15edb6bbaa9ecd4a160da9e2254ed13a2fd90b38ed0`.

Final generation prompt:

```text
Use case: photorealistic-natural.
Asset type: one full-body photographic character cutout for an articulated 2D Paper Puppet game.
Primary request: Create exactly ONE complete connected person, Barack Obama, using the provided photo as the primary identity, physique and outfit reference. Change the pose into the neutral frontal standing pose described below.
Subject and invariant appearance: recognizable Barack Obama, tall lean natural proportions, short salt-and-pepper hair, characteristic ears, warm toothy smile, realistic mature skin and facial detail. Preserve his dark charcoal suit, white shirt, light blue-gray tie and black polished lace-up dress shoes from the photo.
Pose: face and torso square to camera. Stand upright with both shoulders level, both arms relaxed and almost straight down at 10–15 degrees away from the torso, with a continuous clearly visible transparent gap between each arm/hand and torso/hips. Hands empty, relaxed and separated, natural correct fingers. Reconstruct the clasped hands in the reference into separated relaxed hands. Both legs straight and slightly apart with a clear transparent gap between them, feet planted equally and both shoes fully visible. Keep the arms and legs attached naturally to the body.
Composition: 1024x1536 portrait canvas if possible. One entire person centered, large in frame, small safe transparent margins above hair and below soles. Straight-on neutral camera, no foreshortening. Fine crisp natural silhouette edges suitable for transparent cutout extraction.
Style and lighting: realistic photo-inspired editorial portrait, natural skin and cloth texture, soft even lighting across the person. Not a cartoon, caricature, painting, or 3D figurine.
Background: genuine fully transparent alpha outside the person and within all arm/leg gaps. No ground, floor, environment, shadow, glow, halo, or checkerboard image.
Constraints: no other people, props, text, captions, border, watermark, duplicated limbs, dismembered body parts, sprite sheet, or skeleton overlay. Output only the complete single person.
```

**biden-full-body.png** — SHA-256 `b5abc4266f7d1bb4443b15a2d2b4ccbf2a0f2c5f2fb32495ecb9db808f0e7b7c`.

Final generation prompt:

```text
Use case: photorealistic-natural.
Asset type: one full-body photographic character cutout for an articulated 2D Paper Puppet game.
Primary request: Create exactly ONE complete connected person, Joe Biden, using the provided photo as the primary identity, physique and outfit reference. Replace the walking pose with the neutral frontal standing pose described below.
Subject and invariant appearance: recognizable older Joe Biden with his short thin white hair, realistic older facial features and slight smile. Natural human proportions. Preserve the navy suit, vivid bright blue necktie, white shirt, white pocket square, small United States flag lapel pin and black dress shoes in the reference.
Pose: face and torso square to camera. Stand upright with both shoulders level, both arms relaxed and almost straight down at 10–15 degrees away from the torso, with a continuous clearly visible transparent gap between each arm/hand and torso/hips. Hands empty, relaxed and separated, natural correct fingers. Both legs straight and slightly apart with a clear transparent gap between them, feet planted equally and both shoes fully visible. Reconstruct the walking legs into an evenly weighted standing stance. Keep the arms and legs attached naturally to the body.
Composition: 1024x1536 portrait canvas if possible. One entire person centered, large in frame, small safe transparent margins above hair and below soles. Straight-on neutral camera, no foreshortening. Fine crisp natural silhouette edges suitable for transparent cutout extraction.
Style and lighting: realistic photo-inspired editorial portrait, natural skin and cloth texture, soft even lighting across the person. Not a cartoon, caricature, painting, or 3D figurine.
Background: genuine fully transparent alpha outside the person and within all arm/leg gaps. No ground, floor, environment, shadow, glow, halo, or checkerboard image.
Constraints: no other people, props, text, captions, border, watermark, duplicated limbs, dismembered body parts, sprite sheet, or skeleton overlay. Output only the complete single person.
```

**elon-musk-full-body.png** — SHA-256 `469277b8cdbbc038c65e1c6ef01a5fadb0ebb52ab9a25e9196e090ab5c9118c3`.

Final generation prompt:

```text
Use case: photorealistic-natural.
Asset type: one full-body photographic character cutout for an articulated 2D Paper Puppet game.
Primary request: Generate exactly ONE complete connected person, recognizable Elon Musk wearing black sunglasses, an open black leather jacket, a black T-shirt with the exact readable white words "OCCUPY MARS", dark jeans and black boots.
Subject: recognizable Elon Musk with short brown hair, natural sturdy realistic human proportions, characteristic face and slight smile visible below black sunglasses. The leather jacket must be OPEN so that the T-shirt text remains prominently visible on his chest.
Text (verbatim): "OCCUPY MARS" in white uppercase lettering centered on the black T-shirt, clean readable bold sans-serif letters. Exact spelling: O C C U P Y, space, M A R S. No additional shirt text or political logos.
Pose: face and torso square to camera. Stand upright with both shoulders level, both arms relaxed and almost straight down at 10–15 degrees away from the torso, with a continuous clearly visible transparent gap between each arm/hand and torso/hips. Hands empty, relaxed and separated, natural correct fingers. Both legs straight and slightly apart with a clear transparent gap between them, feet planted equally and both boots fully visible. Keep the arms and legs attached naturally to the body.
Composition: 1024x1536 portrait canvas if possible. One entire person centered, large in frame, small safe transparent margins above hair and below soles. Straight-on neutral camera, no foreshortening. Fine crisp natural silhouette edges suitable for transparent cutout extraction.
Style and lighting: realistic photo-inspired editorial portrait, natural skin, leather and denim texture, soft even lighting across the person. Not a cartoon, caricature, painting, or 3D figurine.
Background: genuine fully transparent alpha outside the person and within all arm/leg gaps. No ground, floor, environment, shadow, glow, halo, or checkerboard image.
Constraints: no other people, extra props, added messaging, captions, border, watermark, duplicated limbs, dismembered body parts, sprite sheet, or skeleton overlay. Output only the complete single person.
```


## v32 — Responsive Cast picker

The Cast picker now uses nearly the full window width, capped at 1760 pixels. Character cards flow into as many columns as fit: around five per row on a typical desktop window, more on larger displays, and fewer on tablets and phones. All fourteen characters remain available.

The title, selected count, Clear button, Cancel and Apply cast stay visible while the character cards scroll inside the dialog. Smaller screens use compact cards and side-by-side action buttons. Cast membership, ordering, hidden dancers, sizes, the six-member limit and the default four-person lineup work as before.

The portable package preserves all 33 media files from v31 byte-for-byte. Production compilation, TypeScript and existing cast/sharing checks passed. Browser layout inspection was not available in this environment.
