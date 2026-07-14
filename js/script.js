/* ============================================================
   IRCTC Booking Planner — script.js
   Modular, production-ready JavaScript
   ============================================================ */

(function ($) {
    'use strict';

    /* ======================== CONFIG ======================== */
    const CONFIG = {
        ADVANCE_DAYS: 60,
        BOOKING_HOUR: 8,
        BOOKING_MINUTE: 0,
        EVENT_TITLE: 'IRCTC 60-Day Booking Opens',
        EVENT_DURATION_MIN: 25, // 8:00 - 8:25
        DEFAULT_TITLE: 'BookMyTrain — IRCTC Booking Date Calculator & Countdown Reminder'
    };

    /* ======================== UTILITIES ======================== */
    const Utils = {
        formatDate(date) {
            return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        },
        pad(n) { return String(n).padStart(2, '0'); },
        toISODate(date) {
            const y = date.getFullYear();
            const m = Utils.pad(date.getMonth() + 1);
            const d = Utils.pad(date.getDate());
            return `${y}-${m}-${d}`;
        },
        toGCalDate(date, h, m) {
            // Format: YYYYMMDDTHHmmSS
            return `${date.getFullYear()}${Utils.pad(date.getMonth() + 1)}${Utils.pad(date.getDate())}T${Utils.pad(h)}${Utils.pad(m)}00`;
        },
        addDays(date, days) {
            const d = new Date(date);
            d.setDate(d.getDate() + days);
            return d;
        },
        showToast(msg) {
            $('#toastMessage').text(msg);
            const toast = new bootstrap.Toast($('#appToast')[0]);
            toast.show();
        },
        debounce(func, wait) {
            let timeout;
            return function (...args) {
                const context = this;
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(context, args), wait);
            };
        }
    };

    /* ======================== THEME ======================== */
    const Theme = {
        init() {
            const saved = localStorage.getItem('theme') || 'light';
            this.set(saved);
            $('#themeToggleDesktop, #themeToggleMobile').on('click', () => this.toggle());
        },
        set(theme) {
            $('html').attr('data-bs-theme', theme);
            localStorage.setItem('theme', theme);
            const icon = theme === 'dark' ? 'bi-sun-fill' : 'bi-moon-fill';
            $('.theme-toggle i').attr('class', `bi ${icon}`);
        },
        toggle() {
            const current = $('html').attr('data-bs-theme');
            this.set(current === 'dark' ? 'light' : 'dark');
        }
    };

    /* ======================== NAVBAR ======================== */
    const Navbar = {
        init() {
            $(window).on('scroll', Utils.debounce(this.onScroll, 10));
            this.onScroll();

            // Auto-close offcanvas on mobile when clicking a nav-link
            $('.offcanvas .nav-link').on('click', function () {
                const offcanvasEl = document.getElementById('navOffcanvas');
                const offcanvasInstance = bootstrap.Offcanvas.getInstance(offcanvasEl);
                if (offcanvasInstance) {
                    offcanvasInstance.hide();
                }
            });
        },
        onScroll() {
            const scrollTop = $(window).scrollTop();
            $('#mainNav').toggleClass('scrolled', scrollTop > 20);
            $('#btnBackToTop').toggleClass('visible', scrollTop > 400);
        }
    };

    /* ======================== CALCULATOR ======================== */
    const Calculator = {
        interval: null,
        bookingTarget: null,
        pipWindowRef: null,

        init() {
            // Set min date to today
            const today = Utils.toISODate(new Date());
            $('#journeyDate').attr('min', today);

            $('#calculatorForm').on('submit', (e) => {
                e.preventDefault();
                this.calculate();
            });
            $('#btnReset').on('click', () => this.reset());

            // Shortcuts set date and immediately trigger calculation
            $('#btnToday').on('click', () => {
                this.setDate(new Date());
                this.calculate();
            });
            $('#btnTomorrow').on('click', () => {
                this.setDate(Utils.addDays(new Date(), 1));
                this.calculate();
            });
            $('#btnWeek').on('click', () => {
                this.setDate(Utils.addDays(new Date(), 7));
                this.calculate();
            });

            // Picture-in-Picture Support Check & Event Handler
            if ('documentPictureInPicture' in window) {
                $('#btnPiP').removeClass('d-none').off('click').on('click', () => this.togglePiP());
            }
        },

        async togglePiP() {
            // If already open, close it
            if (window.documentPictureInPicture && window.documentPictureInPicture.window) {
                window.documentPictureInPicture.window.close();
                return;
            }

            try {
                // Request a small floating window
                const pipWindow = await window.documentPictureInPicture.requestWindow({
                    width: 300,
                    height: 150
                });

                this.pipWindowRef = pipWindow;

                // Mark button as active
                $('#btnPiP').html('<i class="bi bi-window-x"></i> Unpin Timer').addClass('btn-primary').removeClass('btn-outline-primary');

                // Get theme & styles
                const activeTheme = $('html').attr('data-bs-theme') || 'light';
                pipWindow.document.documentElement.setAttribute('data-bs-theme', activeTheme);

                // Copy styling sheets to PiP window
                Array.from(document.styleSheets).forEach((styleSheet) => {
                    try {
                        const cssRules = Array.from(styleSheet.cssRules).map((rule) => rule.cssText).join('');
                        const style = document.createElement('style');
                        style.textContent = cssRules;
                        pipWindow.document.head.appendChild(style);
                    } catch (e) {
                        const link = document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = styleSheet.href;
                        pipWindow.document.head.appendChild(link);
                    }
                });

                // Generate inner HTML structure
                const wrapper = pipWindow.document.createElement('div');
                wrapper.className = 'd-flex flex-column align-items-center justify-content-center text-center p-3';
                wrapper.style.height = '100vh';
                wrapper.style.background = 'var(--bg)';
                wrapper.style.margin = '0';
                wrapper.style.overflow = 'hidden';

                const logoSrc = activeTheme === 'dark' ? 'assets/images/bookmytrain_logo_dark.png' : 'assets/images/book_my_train_lightlogo.png';
                const journeyDateVal = $('#resJourneyDate').text();

                wrapper.innerHTML = `
                    <div class="mb-2">
                        <img src="${logoSrc}" alt="BookMyTrain Logo" style="height: 22px; width: auto; object-fit: contain;">
                    </div>
                    <div style="font-size: 0.725rem; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.05em; margin-bottom: 2px;">Booking Opens In</div>
                    <div id="pipTimerDisplay" class="fw-bold text-primary" style="font-size: 1.6rem; font-family: var(--font-mono); letter-spacing: -0.02em;">00:00:00:00</div>
                    <div id="pipJourneyDate" style="font-size: 0.65rem; color: var(--text-muted); margin-top: 2px;">Journey Date: ${journeyDateVal}</div>
                `;
                pipWindow.document.body.appendChild(wrapper);

                // Monitor when PiP closes
                pipWindow.addEventListener('pagehide', () => {
                    this.pipWindowRef = null;
                    $('#btnPiP').html('<i class="bi bi-window"></i> Pin Floating Timer').removeClass('btn-primary').addClass('btn-outline-primary');
                });

                // Sync current time values immediately
                this.updateCountdown();

            } catch (error) {
                console.error('Failed to initialize Picture-in-Picture window:', error);
                Utils.showToast('Could not open floating timer.');
            }
        },

        setDate(date) {
            $('#journeyDate').val(Utils.toISODate(date)).removeClass('is-invalid');
        },

        calculate() {
            const val = $('#journeyDate').val();
            if (!val) {
                $('#journeyDate').addClass('is-invalid');
                return;
            }

            const journey = new Date(val + 'T00:00:00');
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (journey < today) {
                $('#journeyDate').addClass('is-invalid');
                return;
            }

            $('#journeyDate').removeClass('is-invalid');

            // Hide old results
            $('#result-section').addClass('d-none');

            // Show skeleton loader
            $('#skeleton-section').removeClass('d-none');
            $('html, body').animate({
                scrollTop: $('#skeleton-section').offset().top - 100
            }, 300);

            // Simulate quick premium SaaS processing
            setTimeout(() => {
                // Booking date = journey date - 60 days (general advance reservation window)
                const booking = Utils.addDays(journey, -CONFIG.ADVANCE_DAYS);

                // Booking target time: 8:00 AM IST
                this.bookingTarget = new Date(booking);
                this.bookingTarget.setHours(CONFIG.BOOKING_HOUR, CONFIG.BOOKING_MINUTE, 0, 0);

                // Display results
                $('#resJourneyDate').text(Utils.formatDate(journey));
                $('#resBookingDate').text(Utils.formatDate(booking));
                $('#resBookingTime').text('8:00 AM IST');

                // Reset card warning classes and hide warning banner
                $('.card-result').removeClass('booking-passed');
                $('#bookingPassedAlert').addClass('d-none');

                // If PiP is open, update journey date inside it
                if (this.pipWindowRef) {
                    const journeyDateEl = this.pipWindowRef.document.getElementById('pipJourneyDate');
                    if (journeyDateEl) {
                        journeyDateEl.textContent = `Journey Date: ${Utils.formatDate(journey)}`;
                    }
                }

                // Generate calendar & share links
                Calendar.generate(booking);
                Share.generate(journey, booking);

                // Hide skeleton, show results
                $('#skeleton-section').addClass('d-none');
                $('#result-section').removeClass('d-none');

                // Scroll to result
                $('html, body').animate({
                    scrollTop: $('#result-section').offset().top - 10
                }, 300);

                // Start countdown
                this.startCountdown();
            }, 500);
        },

        startCountdown() {
            if (this.interval) clearInterval(this.interval);
            this.updateCountdown();
            this.interval = setInterval(() => this.updateCountdown(), 1000);
        },

        updateCountdown() {
            const now = new Date();
            const diff = this.bookingTarget - now;

            const days = Math.floor(Math.max(0, diff) / 86400000);
            const hours = Math.floor((Math.max(0, diff) % 86400000) / 3600000);
            const minutes = Math.floor((Math.max(0, diff) % 3600000) / 60000);
            const seconds = Math.floor((Math.max(0, diff) % 60000) / 1000);

            const daysText = Utils.pad(days);
            const hoursText = Utils.pad(hours);
            const minutesText = Utils.pad(minutes);
            const secondsText = Utils.pad(seconds);

            if (diff <= 0) {
                clearInterval(this.interval);
                $('#cdDays, #cdHours, #cdMinutes, #cdSeconds').text('00');

                // Show red warning design
                $('.card-result').addClass('booking-passed');
                $('#bookingPassedAlert').removeClass('d-none');

                $('#countdownStatus').html('<span class="text-danger fw-bold"><i class="bi bi-exclamation-triangle-fill"></i> Booking Opened / Passed! Check ASAP!</span>');

                // Restore default tab title
                document.title = CONFIG.DEFAULT_TITLE;

                // Sync PiP window if active
                if (this.pipWindowRef) {
                    const timerEl = this.pipWindowRef.document.getElementById('pipTimerDisplay');
                    if (timerEl) {
                        timerEl.textContent = '00:00:00:00';
                        timerEl.style.color = 'var(--danger)';
                    }
                }
                return;
            }

            this.animateUnit('#cdDays', daysText);
            this.animateUnit('#cdHours', hoursText);
            this.animateUnit('#cdMinutes', minutesText);
            this.animateUnit('#cdSeconds', secondsText);

            // Update browser tab title dynamically with live values
            document.title = `[${daysText}d ${hoursText}h] BookMyTrain`;

            // Sync PiP window text if active
            if (this.pipWindowRef) {
                const timerEl = this.pipWindowRef.document.getElementById('pipTimerDisplay');
                if (timerEl) {
                    timerEl.textContent = `${daysText}:${hoursText}:${minutesText}:${secondsText}`;
                }
            }

            $('#countdownStatus').text('').removeClass('open passed');
        },

        animateUnit(selector, value) {
            const $el = $(selector);
            if ($el.text() !== value) {
                $el.text(value).addClass('tick');
                setTimeout(() => $el.removeClass('tick'), 150);
            }
        },

        reset() {
            if (this.interval) clearInterval(this.interval);

            // Close PiP window if open
            if (this.pipWindowRef) {
                this.pipWindowRef.close();
                this.pipWindowRef = null;
            }

            // Restore base tab title
            document.title = CONFIG.DEFAULT_TITLE;

            $('#journeyDate').val('').removeClass('is-invalid');
            $('#result-section').addClass('d-none');
            $('#skeleton-section').addClass('d-none');
        }
    };

    /* ======================== CALENDAR ======================== */
    const Calendar = {
        generate(bookingDate) {
            const startH = CONFIG.BOOKING_HOUR;
            const startM = CONFIG.BOOKING_MINUTE;
            const endH = startH;
            const endM = startM + CONFIG.EVENT_DURATION_MIN;
            const title = encodeURIComponent(CONFIG.EVENT_TITLE);
            const details = encodeURIComponent('Your BookMyTrain IRCTC advance booking window opens now. Log in and secure your tickets immediately!');

            const startStr = Utils.toGCalDate(bookingDate, startH, startM);
            const endStr = Utils.toGCalDate(bookingDate, endH, endM);

            // Google Calendar
            const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}`;
            $('#calGoogle').attr('href', google);

            // Outlook
            const isoStart = `${Utils.toISODate(bookingDate)}T${Utils.pad(startH)}:${Utils.pad(startM)}:00`;
            const isoEnd = `${Utils.toISODate(bookingDate)}T${Utils.pad(endH)}:${Utils.pad(endM)}:00`;
            const outlook = `https://outlook.live.com/calendar/0/action/compose?subject=${title}&startdt=${isoStart}&enddt=${isoEnd}&body=${details}`;
            $('#calOutlook').attr('href', outlook);

            // Yahoo
            const yahoo = `https://calendar.yahoo.com/?v=60&title=${title}&st=${startStr}&dur=${Utils.pad(0)}${Utils.pad(CONFIG.EVENT_DURATION_MIN)}&desc=${details}`;
            $('#calYahoo').attr('href', yahoo);

            // ICS download
            $('#calICS').off('click').on('click', () => this.downloadICS(bookingDate));
        },

        downloadICS(bookingDate) {
            const startStr = Utils.toGCalDate(bookingDate, CONFIG.BOOKING_HOUR, CONFIG.BOOKING_MINUTE);
            const endStr = Utils.toGCalDate(bookingDate, CONFIG.BOOKING_HOUR, CONFIG.BOOKING_MINUTE + CONFIG.EVENT_DURATION_MIN);

            const ics = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'BEGIN:VEVENT',
                `DTSTART:${startStr}`,
                `DTEND:${endStr}`,
                `SUMMARY:${CONFIG.EVENT_TITLE}`,
                'DESCRIPTION:Your IRCTC advance booking window opens now.',
                'BEGIN:VALARM',
                'TRIGGER:-PT5M',
                'ACTION:DISPLAY',
                'DESCRIPTION:Booking opens in 5 minutes!',
                'END:VALARM',
                'END:VEVENT',
                'END:VCALENDAR'
            ].join('\r\n');

            const blob = new Blob([ics], { type: 'text/calendar' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'irctc-booking-reminder.ics';
            a.click();
            URL.revokeObjectURL(url);
            Utils.showToast('ICS calendar file downloaded!');
        }
    };

    /* ======================== SHARE ======================== */
    const Share = {
        text: '',

        generate(journeyDate, bookingDate) {
            this.text = `🚂 BookMyTrain Reminder\n📅 Journey Date: ${Utils.formatDate(journeyDate)}\n🎫 Booking Release: ${Utils.formatDate(bookingDate)} at 8:00 AM IST\n\nAadhaar priority window opens first. Plan your booking details:\nhttps://bookmytrain.netlify.app/`;
            const encoded = encodeURIComponent(this.text);

            $('#shareWhatsApp').off('click').on('click', () => window.open(`https://wa.me/?text=${encoded}`, '_blank'));
            $('#shareTelegram').off('click').on('click', () => window.open(`https://t.me/share/url?text=${encoded}`, '_blank'));
            $('#shareTwitter').off('click').on('click', () => window.open(`https://twitter.com/intent/tweet?text=${encoded}`, '_blank'));
            $('#shareFacebook').off('click').on('click', () => window.open(`https://www.facebook.com/sharer/sharer.php?quote=${encoded}`, '_blank'));
            $('#shareCopy').off('click').on('click', () => {
                navigator.clipboard.writeText(this.text).then(() => Utils.showToast('Details copied to clipboard!'));
            });

            // Native Share API
            if (navigator.share) {
                $('#shareNative').removeClass('d-none').off('click').on('click', () => {
                    navigator.share({ title: CONFIG.EVENT_TITLE, text: this.text }).catch(() => { });
                });
            }
        }
    };

    /* ======================== SCROLL REVEAL ======================== */
    const Reveal = {
        init() {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(e => {
                    if (e.isIntersecting) {
                        e.target.classList.add('revealed');
                        observer.unobserve(e.target);
                    }
                });
            }, { threshold: 0.05 });

            document.querySelectorAll('.card-feature, .accordion-item').forEach(el => {
                el.classList.add('reveal-item');
                observer.observe(el);
            });
        }
    };

    /* ======================== BACK TO TOP ======================== */
    const BackToTop = {
        init() {
            $('#btnBackToTop').on('click', () => {
                $('html, body').animate({ scrollTop: 0 }, 400);
            });
        }
    };

    /* ======================== INIT ======================== */
    $(function () {
        Theme.init();
        Navbar.init();
        Calculator.init();
        Reveal.init();
        BackToTop.init();

        // Close offcanvas on nav link click
        $('.offcanvas .nav-link').on('click', function () {
            const offcanvasElement = $('#navOffcanvas')[0];
            const offcanvas = bootstrap.Offcanvas.getInstance(offcanvasElement);
            if (offcanvas) offcanvas.hide();
        });

        // Initialize tooltips
        $('[data-bs-toggle="tooltip"]').each(function () {
            new bootstrap.Tooltip(this);
        });

        // Register PWA service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').then((reg) => {
                console.log('Service Worker registered successfully with scope:', reg.scope);
            }).catch((err) => {
                console.error('Service Worker registration failed:', err);
            });
        }
    });

})(jQuery);
