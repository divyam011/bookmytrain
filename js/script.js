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
        EVENT_DURATION_MIN: 25 // 8:00 - 8:25
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
            return `${date.getFullYear()}${Utils.pad(date.getMonth()+1)}${Utils.pad(date.getDate())}T${Utils.pad(h)}${Utils.pad(m)}00`;
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
            $(window).on('scroll', Utils.debounce ? Utils.debounce(this.onScroll, 10) : this.onScroll);
            this.onScroll();
        },
        onScroll() {
            $('#mainNav').toggleClass('scrolled', $(window).scrollTop() > 20);
            $('#btnBackToTop').toggleClass('visible', $(window).scrollTop() > 400);
        }
    };

    /* ======================== CALCULATOR ======================== */
    const Calculator = {
        interval: null,
        bookingTarget: null,

        init() {
            // Set min date to today
            const today = Utils.toISODate(new Date());
            $('#journeyDate').attr('min', today);

            $('#calculatorForm').on('submit', (e) => { e.preventDefault(); this.calculate(); });
            $('#btnReset').on('click', () => this.reset());
            $('#btnToday').on('click', () => this.setDate(new Date()));
            $('#btnTomorrow').on('click', () => this.setDate(Utils.addDays(new Date(), 1)));
            $('#btnWeek').on('click', () => this.setDate(Utils.addDays(new Date(), 7)));
        },

        setDate(date) {
            $('#journeyDate').val(Utils.toISODate(date)).removeClass('is-invalid');
        },

        calculate() {
            const val = $('#journeyDate').val();
            if (!val) { $('#journeyDate').addClass('is-invalid'); return; }

            const journey = new Date(val + 'T00:00:00');
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (journey < today) { $('#journeyDate').addClass('is-invalid'); return; }

            $('#journeyDate').removeClass('is-invalid');

            // Booking date = journey date - 60 days (general advance reservation window)
            const booking = Utils.addDays(journey, -CONFIG.ADVANCE_DAYS);

            // Booking target time: 8:00 AM IST
            this.bookingTarget = new Date(booking);
            this.bookingTarget.setHours(CONFIG.BOOKING_HOUR, CONFIG.BOOKING_MINUTE, 0, 0);

            // Display results
            $('#resJourneyDate').text(Utils.formatDate(journey));
            $('#resBookingDate').text(Utils.formatDate(booking));
            $('#resBookingTime').text('8:00 AM IST');

            // Generate calendar & share links
            Calendar.generate(booking);
            Share.generate(journey, booking);

            // Show result section
            $('#result-section').removeClass('d-none');

            // Scroll to result
            $('html, body').animate({ scrollTop: $('#result-section').offset().top - 80 }, 400);

            // Start countdown
            this.startCountdown();
        },

        startCountdown() {
            if (this.interval) clearInterval(this.interval);
            this.updateCountdown();
            this.interval = setInterval(() => this.updateCountdown(), 1000);
        },

        updateCountdown() {
            const now = new Date();
            const diff = this.bookingTarget - now;

            if (diff <= 0) {
                clearInterval(this.interval);
                $('#cdDays, #cdHours, #cdMinutes, #cdSeconds').text('00');
                $('#countdownStatus').text('🎉 Booking is OPEN! Go book now!').addClass('open').removeClass('passed');
                return;
            }

            const days = Math.floor(diff / 86400000);
            const hours = Math.floor((diff % 86400000) / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);

            this.animateUnit('#cdDays', Utils.pad(days));
            this.animateUnit('#cdHours', Utils.pad(hours));
            this.animateUnit('#cdMinutes', Utils.pad(minutes));
            this.animateUnit('#cdSeconds', Utils.pad(seconds));

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
            $('#journeyDate').val('').removeClass('is-invalid');
            $('#result-section').addClass('d-none');
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
            const details = encodeURIComponent('Your IRCTC advance booking window opens now. Log in and book your ticket!');

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
            Utils.showToast('ICS file downloaded!');
        }
    };

    /* ======================== SHARE ======================== */
    const Share = {
        text: '',

        generate(journeyDate, bookingDate) {
            this.text = `🚂 IRCTC Booking Reminder\n📅 Journey: ${Utils.formatDate(journeyDate)}\n🎫 Booking Opens: ${Utils.formatDate(bookingDate)} at 8:00 AM IST\n\nAadhaar-authenticated users get opening-day priority. Don't miss it!`;
            const encoded = encodeURIComponent(this.text);

            $('#shareWhatsApp').off('click').on('click', () => window.open(`https://wa.me/?text=${encoded}`, '_blank'));
            $('#shareTelegram').off('click').on('click', () => window.open(`https://t.me/share/url?text=${encoded}`, '_blank'));
            $('#shareTwitter').off('click').on('click', () => window.open(`https://twitter.com/intent/tweet?text=${encoded}`, '_blank'));
            $('#shareFacebook').off('click').on('click', () => window.open(`https://www.facebook.com/sharer/sharer.php?quote=${encoded}`, '_blank'));
            $('#shareCopy').off('click').on('click', () => {
                navigator.clipboard.writeText(this.text).then(() => Utils.showToast('Copied to clipboard!'));
            });

            // Native Share API
            if (navigator.share) {
                $('#shareNative').removeClass('d-none').off('click').on('click', () => {
                    navigator.share({ title: CONFIG.EVENT_TITLE, text: this.text }).catch(() => {});
                });
            }
        }
    };

    /* ======================== SCROLL REVEAL ======================== */
    const Reveal = {
        init() {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); observer.unobserve(e.target); } });
            }, { threshold: 0.1 });

            document.querySelectorAll('.card-feature, .accordion-item').forEach(el => {
                el.classList.add('reveal-item');
                observer.observe(el);
            });
        }
    };

    /* ======================== BACK TO TOP ======================== */
    const BackToTop = {
        init() {
            $('#btnBackToTop').on('click', () => $('html, body').animate({ scrollTop: 0 }, 400));
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
            const offcanvas = bootstrap.Offcanvas.getInstance($('#navOffcanvas')[0]);
            if (offcanvas) offcanvas.hide();
        });

        // Tooltips
        $('[data-bs-toggle="tooltip"]').each(function () { new bootstrap.Tooltip(this); });
    });

})(jQuery);
