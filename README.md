# UPSC Daily Current Affairs

A personal current affairs page for UPSC CSE 2027. It shows national and international news that matters for the exam, sorted by GS paper and topic.

## Daily use
1. Double-click **start.bat**. The page opens at http://localhost:3000.
2. Click **⟳ Refresh news** at any time. The latest stories are fetched and added to the page, marked **NEW**.
3. Keep the black start.bat window open while you use the page. Close it when you're done.

Other options:
- **update.bat** fetches news without the server, then opens the page.
- Opening **index.html** directly shows whatever was fetched last. The Refresh button only works through start.bat.

**Automatic updates:** double-click **schedule-daily.bat** once. Windows will then fetch news every day at 7 AM and 7 PM.

## Features
- **Today:** a greeting, a reading-progress ring, your daily study streak 🔥, Prelims and Mains countdowns, and a 25-minute **focus timer**
- **Topic-coloured story cards:** filter by **GS-1 / GS-2 / GS-3 / Prelims** and by topic. Use **★ Important only** and **Hide read** to narrow the list
- **✓ Mark read** and **🔖 Revise** on every story. Saved stories go to the **Revision** list
- **Archive:** a calendar shaded by how much news each day had (a green dot means you read everything that day), plus a list of days with their top headlines
- **Search** across all days. Press `/` to jump to the search box
- **Break Zone 🎮:** a 2048 game you can play for **5 minutes**, then it locks for **2 hours**. The timer keeps running if you leave or reload the page
- Light and dark mode, works on phones (bottom navigation bar), smooth animations (reduced if your device's "reduce motion" setting is on)

Your progress (read, saved, streak, game timer) is stored in your browser on each device.

## Sources
- The Hindu: National, International, Economy, Science, Environment, Health, Editorials
- Indian Express: Explained
- Mint: Economy

## Customising
- **Exam dates, game length, cooldown, focus length:** the settings at the top of `app.js`. The exam dates are tentative; update them when UPSC publishes the official calendar.
- **Feeds, keywords, exclusions:** `FEEDS`, `TOPICS` and `EXCLUDE` in `fetch-news.js`
