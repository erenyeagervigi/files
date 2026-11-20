(function () {
  "use strict";

  const config = window.PORTFOLIO_CONFIG || {};
  const projects = Array.isArray(window.PORTFOLIO_PROJECTS) ? window.PORTFOLIO_PROJECTS : [];
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const slowConnection = !!(connection && (connection.saveData || /(2g|3g)/.test(connection.effectiveType || "")));
  const canHover = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const header = document.getElementById("site-header");
  const grid = document.getElementById("projects-grid");
  const lightbox = document.getElementById("lightbox");
  const lightboxPlayer = document.getElementById("lightbox-player");
  const lightboxTitle = document.getElementById("lightbox-title");
  const lightboxDescription = document.getElementById("lightbox-description");
  const closeButton = document.querySelector(".lightbox-close");
  let lastFocused = null;
  let activeProject = null;
  let videoObserver = null;
  let revealObserver = null;

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];
    });
  }

  function sourceFor(item) {
    return item.previewSrc || item.videoSrc || "";
  }

  function parseAspect(v) {
    if (!v) return null;
    const p = String(v).split(/[:\/x]/).map(Number);
    return p.length === 2 && p[0] > 0 && p[1] > 0 ? { w: p[0], h: p[1] } : null;
  }

  function orientOf(r) { return r < 0.9 ? "portrait" : r < 1.6 ? "square" : "landscape"; }

  function applyAspect(el, a) {
    if (!el || !a) return;
    const r = a.w / a.h;
    el.style.setProperty("--ar", a.w + " / " + a.h);
    el.style.setProperty("--arn", r.toFixed(4));
    el.dataset.ar = r.toFixed(4);
    el.dataset.orient = orientOf(r);
  }

  function aspectAttrs(a) {
    if (!a) return "";
    const r = a.w / a.h;
    return ' data-aspect="fixed" data-ar="' + r.toFixed(4) + '" data-orient="' + orientOf(r) + '" style="--ar:' + a.w + ' / ' + a.h + ';--arn:' + r.toFixed(4) + '"';
  }

  function cardOf(el) { return el && el.closest ? el.closest(".project-card") : null; }

  /* keeps the card buttons + "is-playing" look in sync with the real video state */
  function syncCardUI(card, video) {
    if (!card || !video) return;
    const playing = !video.paused && !video.ended;
    card.classList.toggle("is-playing", playing);
    const toggle = card.querySelector("[data-preview-toggle]");
    if (toggle) {
      toggle.textContent = playing ? "Ⅱ" : "▶";
      toggle.setAttribute("aria-label", playing ? "Pause inline preview" : "Play inline preview");
      toggle.setAttribute("aria-pressed", playing ? "true" : "false");
    }
    const mute = card.querySelector("[data-mute-toggle]");
    if (mute) {
      mute.textContent = video.muted ? "SOUND OFF" : "SOUND ON";
      mute.setAttribute("aria-label", video.muted ? "Turn preview sound on" : "Turn preview sound off");
      mute.setAttribute("aria-pressed", video.muted ? "false" : "true");
    }
  }

  function loadVideo(video) {
    if (!video || video.dataset.loaded === "true") return;
    const src = video.dataset.lazySrc;
    if (!src) return;
    video.dataset.loaded = "true";
    const media = video.closest(".project-media");
    const card = cardOf(video);
    function ready() {
      if (media) media.classList.add("is-loaded");
      video.classList.add("has-frame");
    }
    /* loadedmetadata (not only loadeddata): iOS Safari won't fetch a frame
       with preload="metadata", so the spinner used to spin forever there. */
    video.addEventListener("loadedmetadata", function () {
      if (media && media.dataset.aspect !== "fixed" && video.videoWidth && video.videoHeight) {
        applyAspect(media, { w: video.videoWidth, h: video.videoHeight });
      }
      ready();
    }, {once:true});
    video.addEventListener("loadeddata", ready, {once:true});
    video.addEventListener("error", function () {
      if (media) media.classList.add("video-unavailable");
      ready();
    }, {once:true});
    if (card) {
      ["play", "pause", "ended", "volumechange"].forEach(function (name) {
        video.addEventListener(name, function () { syncCardUI(card, video); });
      });
    }
    video.preload = "metadata";
    video.src = src;
    video.load();
  }

  function setupLazyVideos(root) {
    const videos = Array.from((root || document).querySelectorAll("video[data-lazy-src]"));
    if ("IntersectionObserver" in window) {
      if (!videoObserver) {
        videoObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            loadVideo(entry.target);
            videoObserver.unobserve(entry.target);
          });
        }, {rootMargin:"300px 0px",threshold:0.01});
      }
      videos.forEach(function (video) { videoObserver.observe(video); });
    } else {
      videos.forEach(loadVideo);
    }
  }

  /* opts.force: user pressed play, so ignore reduced-motion. opts.keepSound: don't re-mute. */
  function playMuted(video, opts) {
    const o = opts || {};
    if (!video || (reducedMotion && !o.force)) return;
    loadVideo(video);
    if (!o.keepSound) video.muted = true;
    const p = video.play();
    if (p && typeof p.catch === "function") p.catch(function () {});
  }

  function stopPreview(video) {
    if (!video) return;
    video.pause();
    try { video.currentTime = 0; } catch (e) {}
    video.muted = true;
    syncCardUI(cardOf(video), video);
  }

  /* ---- touch devices: no hover, so play the card that is most in view ---- */
  const mediaRatios = new Map();
  let autoplayObserver = null;

  function lightboxIsOpen() { return !!lightbox && lightbox.classList.contains("is-open"); }

  function pickActiveCard() {
    if (lightboxIsOpen()) return;
    let best = null, bestRatio = 0;
    mediaRatios.forEach(function (ratio, media) {
      const card = cardOf(media);
      if (ratio >= 0.55 && ratio > bestRatio && card && card.dataset.userChoice !== "pause") { best = media; bestRatio = ratio; }
    });
    mediaRatios.forEach(function (ratio, media) {
      const video = media.querySelector("video");
      const card = cardOf(media);
      if (!video || !card) return;
      if (media === best) { if (video.paused) playMuted(video); }
      else if (!video.paused && card.dataset.userChoice !== "play") video.pause();
    });
  }

  function setupMobileAutoplay() {
    if (canHover || reducedMotion || slowConnection || !("IntersectionObserver" in window)) return;
    autoplayObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        const media = entry.target;
        if (entry.isIntersecting && entry.intersectionRatio > 0) {
          mediaRatios.set(media, entry.intersectionRatio);
        } else {
          mediaRatios.delete(media);
          const card = cardOf(media);
          if (card) delete card.dataset.userChoice;
          const video = media.querySelector("video");
          if (video && !video.paused) video.pause();
        }
      });
      pickActiveCard();
    }, {threshold:[0, 0.2, 0.4, 0.55, 0.7, 0.85, 1]});
  }

  function watchCardsForAutoplay() {
    if (!autoplayObserver || !grid) return;
    autoplayObserver.disconnect();
    mediaRatios.clear();
    grid.querySelectorAll(".project-media").forEach(function (media) {
      if (media.querySelector("video")) autoplayObserver.observe(media);
    });
  }

  function renderProject(item, index) {
    const src = sourceFor(item);
    const canPreview = !!src;
    const mediaLabel = "Play full video: " + item.title;
    const ar = parseAspect(item.aspect);
    return '<article class="project-card reveal' + (index % 2 ? ' is-alt' : '') + '" data-card-id="' + esc(item.id) + '" style="--card-delay:' + (index % 2 ? "80ms" : "0ms") + ';--i:' + index + '">' +
      '<div class="project-media"' + aspectAttrs(ar) + '>' +
        (canPreview ? '<video class="project-video" muted playsinline loop preload="metadata" poster="' + esc(item.poster) + '" data-lazy-src="' + esc(src) + '" aria-label="' + esc(item.title + " muted preview") + '"></video>' : '<img class="project-video project-poster" src="' + esc(item.poster) + '" alt="' + esc(item.title + " poster") + '" loading="lazy">') +
        '<span class="video-spinner" aria-hidden="true"></span>' +
        (item.sample ? '<span class="demo-stamp">SAMPLE FOOTAGE</span>' : '') +
        '<button class="project-open" type="button" data-open-project="' + esc(item.id) + '" aria-label="' + esc(mediaLabel) + '"><span class="project-overlay-label">WATCH PROJECT ↗</span></button>' +
        (canPreview ? '<div class="card-video-controls"><button class="card-control" type="button" data-preview-toggle aria-label="Play inline preview" aria-pressed="false">▶</button><button class="card-control" type="button" data-mute-toggle aria-label="Turn preview sound on" aria-pressed="false">SOUND OFF</button></div>' : '') +
      '</div>' +
      '<div class="project-info"><div><h3 class="project-title">' + esc(item.title) + '</h3><p class="project-description">' + esc(item.description) + '</p></div>' +
      '<div class="project-meta"><span class="project-category">' + esc(item.category) + '</span><span class="project-duration">' + esc(item.duration || "—") + '</span></div>' +
      '<button class="watch-link" type="button" data-open-project="' + esc(item.id) + '">WATCH FULL EDIT <span>↗</span></button></div></article>';
  }

  function renderProjects(filter) {
    if (!grid) return;
    const filtered = filter === "All" ? projects : projects.filter(function (item) { return item.category === filter; });
    grid.innerHTML = filtered.map(renderProject).join("");
    const count = document.getElementById("work-count");
    if (count) count.textContent = String(filtered.length).padStart(2, "0") + " PROJECT" + (filtered.length === 1 ? "" : "S");
    grid.querySelectorAll(".reveal").forEach(function (el) {
      if (revealObserver) revealObserver.observe(el); else el.classList.add("is-visible");
    });
    setupLazyVideos(grid);
    watchCardsForAutoplay();
  }

  function getEmbedUrl(item) {
    const raw = item.embedUrl || item.drivePreview || "";
    if (!raw) return "";
    try {
      const url = new URL(raw);
      if (url.hostname.indexOf("youtube.com") >= 0 || url.hostname.indexOf("youtu.be") >= 0) {
        url.searchParams.set("autoplay", "1");
        url.searchParams.set("playsinline", "1");
        url.searchParams.set("rel", "0");
      } else if (url.hostname.indexOf("vimeo.com") >= 0) {
        url.searchParams.set("autoplay", "1");
        url.searchParams.set("title", "0");
        url.searchParams.set("byline", "0");
      } else if (url.hostname.indexOf("drive.google.com") >= 0) {
        url.searchParams.set("autoplay", "1");
      }
      return url.toString();
    } catch (e) {
      return raw;
    }
  }

  function closePlayer() {
    if (!lightbox.classList.contains("is-open")) return;
    const media = lightboxPlayer.querySelector("video");
    if (media) { media.pause(); media.removeAttribute("src"); media.load(); }
    lightboxPlayer.innerHTML = "";
    lightbox.classList.remove("is-open");
    lightbox.style.removeProperty("--ar");
    lightbox.style.removeProperty("--arn");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    activeProject = null;
    if (document.fullscreenElement && document.exitFullscreen) {
      const exit = document.exitFullscreen();
      if (exit && exit.catch) exit.catch(function () {});
    }
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
    pickActiveCard();
  }

  function openPlayer(item, options) {
    if (!item || !lightbox) return;
    const opts = options || {};
    lastFocused = document.activeElement;
    activeProject = item;
    lightboxTitle.textContent = (item.title || "NOW PLAYING").toUpperCase();
    lightboxDescription.textContent = item.description || "Selected work by Vignesh";
    lightboxPlayer.innerHTML = '<span class="modal-loader" aria-hidden="true"></span>';
    if (grid) grid.querySelectorAll("video").forEach(function (v) { v.pause(); });
    lightbox.style.removeProperty("--ar");
    lightbox.style.removeProperty("--arn");
    const cardMedia = document.querySelector('.project-card[data-card-id="' + item.id + '"] .project-media');
    const known = parseAspect(item.aspect) || (cardMedia && cardMedia.dataset.ar ? { w: Number(cardMedia.dataset.ar), h: 1 } : null);
    if (known) applyAspect(lightbox, known);
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    if (item.videoSrc) {
      const video = document.createElement("video");
      video.className = "modal-video";
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.preload = "auto";
      video.muted = false;
      video.poster = item.poster || "";
      video.setAttribute("aria-label", item.title || "Portfolio video");
      video.setAttribute("controlsList", "nodownload");
      if (item.captions && item.captions.src) {
        const track = document.createElement("track");
        track.kind = "captions";
        track.src = item.captions.src;
        track.srclang = item.captions.srclang || "en";
        track.label = item.captions.label || "English";
        track.default = true;
        video.appendChild(track);
      }
      video.addEventListener("loadedmetadata", function () {
        if (!parseAspect(item.aspect) && video.videoWidth && video.videoHeight) applyAspect(lightbox, { w: video.videoWidth, h: video.videoHeight });
      }, {once:true});
      video.addEventListener("canplay", function () {
        const loader = lightboxPlayer.querySelector(".modal-loader");
        if (loader) loader.remove();
      }, {once:true});
      video.addEventListener("error", function () {
        const loader = lightboxPlayer.querySelector(".modal-loader");
        if (loader) loader.remove();
        const message = document.createElement("p");
        message.className = "modal-error";
        message.textContent = "This video could not be loaded. Check the direct MP4/WebM URL in projects.js.";
        lightboxPlayer.appendChild(message);
      }, {once:true});
      video.src = item.videoSrc;
      lightboxPlayer.appendChild(video);
      const play = video.play();
      if (play && play.catch) play.catch(function () {});
      if (opts.fullscreen && lightboxPlayer.requestFullscreen) {
        const fs = lightboxPlayer.requestFullscreen();
        if (fs && fs.catch) fs.catch(function () {});
      }
    } else {
      const embedUrl = getEmbedUrl(item);
      if (embedUrl) {
        const frame = document.createElement("iframe");
        frame.src = embedUrl;
        frame.title = (item.title || "Portfolio video") + " video player";
        frame.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
        frame.allowFullscreen = true;
        frame.loading = "eager";
        frame.referrerPolicy = "strict-origin-when-cross-origin";
        lightboxPlayer.appendChild(frame);
        const loader = lightboxPlayer.querySelector(".modal-loader");
        if (loader) loader.remove();
        if (opts.fullscreen && lightboxPlayer.requestFullscreen) {
          const fs = lightboxPlayer.requestFullscreen();
          if (fs && fs.catch) fs.catch(function () {});
        }
      } else {
        lightboxPlayer.innerHTML = '<p class="modal-error">Add a videoSrc, embedUrl or Drive preview URL for this project in projects.js.</p>';
      }
    }
    closeButton.focus();
  }

  function projectById(id) {
    return projects.find(function (item) { return item.id === id; });
  }

  function setupFilters() {
    const tabs = document.getElementById("filter-tabs");
    if (!tabs) return;
    tabs.addEventListener("click", function (event) {
      const button = event.target.closest("[data-filter]");
      if (!button) return;
      tabs.querySelectorAll(".filter-tab").forEach(function (tab) {
        const active = tab === button;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-pressed", active ? "true" : "false");
      });
      renderProjects(button.dataset.filter);
    });
  }

  function setupGridControls() {
    if (!grid) return;
    grid.addEventListener("click", function (event) {
      const previewButton = event.target.closest("[data-preview-toggle]");
      const muteButton = event.target.closest("[data-mute-toggle]");
      const openButton = event.target.closest("[data-open-project]");
      if (previewButton) {
        const media = previewButton.closest(".project-media");
        const video = media && media.querySelector("video");
        const card = cardOf(media);
        if (!video || !card) return;
        if (video.paused) {
          card.dataset.userChoice = "play";
          playMuted(video, {force:true, keepSound:true});
        } else {
          card.dataset.userChoice = "pause";
          video.pause();
        }
        return;
      }
      if (muteButton) {
        const media = muteButton.closest(".project-media");
        const video = media && media.querySelector("video");
        if (!video) return;
        video.muted = !video.muted;
        syncCardUI(cardOf(media), video);
        return;
      }
      if (openButton) {
        const item = projectById(openButton.dataset.openProject);
        if (item) openPlayer(item);
      }
    });

    grid.addEventListener("pointerover", function (event) {
      if (!canHover || reducedMotion) return;
      const card = event.target.closest(".project-card");
      if (!card || card.contains(event.relatedTarget)) return;
      const video = card.querySelector(".project-video");
      if (video && video.tagName.toLowerCase() === "video") {
        playMuted(video);
      }
    });
    grid.addEventListener("pointerout", function (event) {
      if (!canHover) return;
      const card = event.target.closest(".project-card");
      if (!card || card.contains(event.relatedTarget)) return;
      const video = card.querySelector("video");
      if (video) stopPreview(video);
    });
  }

  function setupShowreel() {
    const frame = document.getElementById("showreel-frame");
    const video = document.getElementById("showreel-video");
    if (!frame || !video) return;
    const spinner = frame.querySelector(".showreel-spinner");
    video.addEventListener("loadeddata", function () { if (spinner) spinner.remove(); }, {once:true});
    video.addEventListener("error", function () { if (spinner) spinner.remove(); }, {once:true});
    if (reducedMotion || slowConnection) { if (spinner) spinner.remove(); return; }
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) playMuted(video);
          else video.pause();
        });
      }, {threshold:0.35});
      observer.observe(frame);
    } else {
      playMuted(video);
    }
  }

  function setupHero() {
    const video = document.getElementById("hero-video");
    if (!video) return;
    if (reducedMotion || slowConnection) {
      video.pause();
      return;
    }
    const source = video.querySelector("source[data-src]");
    if (source) {
      source.src = source.dataset.src;
      video.load();
      const play = video.play();
      if (play && play.catch) play.catch(function () {});
    }
  }

  function setupReveal() {
    const elements = document.querySelectorAll(".reveal");
    if (reducedMotion || !("IntersectionObserver" in window)) {
      elements.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, {threshold:0.08,rootMargin:"0px 0px -35px 0px"});
    elements.forEach(function (el) { revealObserver.observe(el); });
  }

  function setupNavigation() {
    function updateHeader() {
      if (header) header.classList.toggle("is-scrolled", window.scrollY > 32);
    }
    updateHeader();
    window.addEventListener("scroll", updateHeader, {passive:true});
    const menuButton = document.getElementById("menu-toggle");
    const nav = document.getElementById("primary-nav");
    if (menuButton && nav) {
      menuButton.addEventListener("click", function () {
        const open = nav.classList.toggle("is-open");
        menuButton.setAttribute("aria-expanded", open ? "true" : "false");
        menuButton.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      });
      nav.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
          nav.classList.remove("is-open");
          menuButton.setAttribute("aria-expanded", "false");
          menuButton.setAttribute("aria-label", "Open navigation");
        });
      });
    }
  }

  function setupLightbox() {
    document.querySelectorAll("[data-open-showreel]").forEach(function (button) {
      button.addEventListener("click", function () {
        const item = config.showreel || {};
        const fullscreen = !!button.closest("#showreel-frame");
        openPlayer(item, {fullscreen:fullscreen});
      });
    });
    lightbox.addEventListener("click", function (event) {
      if (event.target.closest("[data-close-lightbox]")) closePlayer();
    });
    document.addEventListener("keydown", function (event) {
      if (!lightbox.classList.contains("is-open")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closePlayer();
      } else if (event.key === "Tab") {
        const focusable = Array.from(lightbox.querySelectorAll("button,a,[tabindex]:not([tabindex='-1'])")).filter(function (el) { return !el.disabled; });
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
  }

  function iconMarkup(name) {
    const icons = {
      instagram:'<rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><path d="M17.5 6.5h.01"></path>',
      youtube:'<path d="M22 12s0-3.3-.4-4.8a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 24.5 24.5 0 0 0 2 12s0 3.3.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A24.5 24.5 0 0 0 22 12Z"></path><path d="m10 9 5 3-5 3z"></path>',
      linkedin:'<path d="M4 9v11M4 4v.01M9 20v-6a4 4 0 0 1 8 0v6M9 10v10"></path><rect x="2" y="2" width="20" height="20" rx="2"></rect>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (icons[name] || "") + '</svg>';
  }

  function setupContact() {
    const email = config.email || "";
    const emailLink = document.getElementById("contact-email");
    if (emailLink) {
      if (email) {
        emailLink.href = "mailto:" + email;
        emailLink.querySelector("span") || null;
        const textNode = Array.from(emailLink.childNodes).find(function (node) { return node.nodeType === 3; });
        if (textNode) textNode.nodeValue = email + " ";
        else emailLink.insertBefore(document.createTextNode(email + " "), emailLink.firstChild);
      } else {
        emailLink.hidden = true;
      }
    }
    const socialWrap = document.getElementById("social-links");
    if (socialWrap) {
      const socials = Array.isArray(config.socials) ? config.socials : [];
      socialWrap.innerHTML = socials.map(function (social) {
        const label = esc(social.label || social.icon || "Social");
        const svg = iconMarkup(social.icon);
        if (social.url) return '<a class="social-link" href="' + esc(social.url) + '" target="_blank" rel="noopener noreferrer" aria-label="' + label + '">' + svg + '</a>';
        return '<span class="social-link social-placeholder" title="Add your ' + label + ' URL in projects.js" aria-label="' + label + ' profile not set">' + svg + '</span>';
      }).join("");
    }
    const year = document.getElementById("year");
    if (year) year.textContent = new Date().getFullYear();
  }

  setupNavigation();
  setupReveal();
  renderProjects("All");
  setupFilters();
  setupGridControls();
  setupMobileAutoplay();
  watchCardsForAutoplay();
  setupShowreel();
  setupHero();
  setupLightbox();
  setupContact();
})();