# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Academic personal website for Loris Gaven (INRIA researcher). Static HTML site hosted on GitHub Pages with custom domain lgaven.me.

## Hosting

- **Platform**: GitHub Pages
- **Custom domain**: lgaven.me (configured via CNAME file)
- **Deployment**: Automatic on push to main branch

## Development

No build step required - edit HTML/CSS/JS files directly. To preview locally, open `index.html` in a browser or use a local server:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000
