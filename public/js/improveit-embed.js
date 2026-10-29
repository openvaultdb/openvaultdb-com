// Generated from scripts/vendor/improveit-embed.ts; see its provenance file.
// The deployed script has a permanent global guard and an anonymous window listener.
// Retain its runtime for the document lifetime rather than trying to unload/re-execute it.
const runtimes = new WeakMap();
/** Equivalent copied configurations share one runtime; changing product or origin policy needs a new document. */
export function feedbackConfigKey(config) {
    return JSON.stringify([
        config.app,
        config.space,
        config.screen ?? 'app',
        [...new Set(config.origins)].sort(),
    ]);
}
class DocumentWidget {
    doc;
    win;
    config;
    configKey;
    owners = new Set();
    state = 'idle';
    host;
    api;
    pending;
    constructor(doc, win, config) {
        this.doc = doc;
        this.win = win;
        this.config = config;
        this.configKey = feedbackConfigKey(config);
    }
    allowed(owner) {
        let eligible = false;
        try {
            eligible = owner.eligible();
        }
        catch {
            /* A host gate failure denies access. */
        }
        return (eligible &&
            this.owners.has(owner) &&
            owner.enabled &&
            this.config.origins.includes(this.win.location.origin));
    }
    update() {
        if (this.pending &&
            (this.pending.epoch !== this.pending.owner.epoch ||
                !this.allowed(this.pending.owner)))
            this.pending = undefined;
        const active = [...this.owners].some((owner) => this.allowed(owner));
        if (this.state === 'ready' && this.win.ImproveIt !== this.api) {
            this.state = 'unavailable';
            this.pending = undefined;
        }
        if (active && this.state === 'ready' && this.host) {
            if (!this.host.isConnected)
                this.doc.body.append(this.host);
        }
        else {
            // Never operate on a replaced/foreign global, even during cleanup.
            if (this.win.ImproveIt === this.api)
                this.api?.close();
            this.host?.remove();
        }
        for (const owner of this.owners) {
            const available = this.allowed(owner) && this.state !== 'unavailable';
            owner.notify(available && this.state === 'ready', available && this.state === 'failed', available, available && this.state === 'loading');
        }
        const pending = this.pending;
        if (pending && this.state === 'ready') {
            this.pending = undefined;
            if (pending.epoch === pending.owner.epoch &&
                this.allowed(pending.owner) &&
                this.host?.isConnected &&
                this.win.ImproveIt === this.api) {
                // Touch activation in WebKit need not focus the local launcher. Give the
                // SDK an explicit, connected return target before it captures activeElement.
                const trigger = pending.owner.trigger;
                if (trigger?.isConnected && trigger.ownerDocument === this.doc)
                    trigger.focus();
                // Focusing can synchronously enter authentication or change configuration.
                if (pending.epoch === pending.owner.epoch &&
                    this.allowed(pending.owner) &&
                    this.host?.isConnected &&
                    this.win.ImproveIt === this.api)
                    this.api?.open();
                else
                    this.update();
            }
        }
    }
    activate(owner, retry = false) {
        this.update();
        if (!this.allowed(owner) || this.state === 'unavailable')
            return;
        if (this.state === 'failed' && !retry)
            return;
        this.pending ??= { owner, epoch: owner.epoch };
        if (this.state === 'idle' || (retry && this.state === 'failed'))
            this.start();
        this.update();
    }
    start() {
        // Existing globals/hosts have no ownership proof. Never replace or close them.
        if (this.win.ImproveIt !== undefined ||
            this.doc.querySelector('[data-improveit-host]')) {
            this.state = 'unavailable';
            return;
        }
        this.state = 'loading';
        const script = this.doc.createElement('script');
        script.src = 'https://improveit.now/widget.js';
        script.async = true;
        script.referrerPolicy = 'no-referrer';
        script.dataset['space'] = this.config.space;
        script.dataset['app'] = this.config.app;
        script.dataset['screen'] = this.config.screen ?? 'app';
        script.dataset['launcher'] = 'hidden';
        script.dataset['lang'] = [
            this.doc.documentElement.lang,
            this.win.navigator.language,
        ].some((language) => /^ru(?:-|$)/i.test(language))
            ? 'ru'
            : 'en';
        const loaded = () => {
            script.removeEventListener('error', failed);
            const candidate = this.win.ImproveIt;
            // The SDK captures these at startup. Its exact script reference proves this
            // completion created the runtime; DOM appearance alone cannot prove ownership.
            if (script.src !== 'https://improveit.now/widget.js' ||
                script.dataset['app'] !== this.config.app ||
                script.dataset['space'] !== this.config.space ||
                script.dataset['screen'] !== (this.config.screen ?? 'app') ||
                script.dataset['launcher'] !== 'hidden' ||
                script.referrerPolicy !== 'no-referrer' ||
                !candidate ||
                candidate.sourceScript !== script ||
                candidate.appID !== this.config.app ||
                candidate.spaceID !== this.config.space) {
                this.state = 'unavailable';
                this.update();
                return;
            }
            const host = this.doc.querySelector('[data-improveit-host]');
            if (host) {
                this.host = host;
                this.api = candidate;
                this.state = 'ready';
            }
            else
                this.state = 'unavailable';
            this.update();
        };
        const failed = () => {
            script.removeEventListener('load', loaded);
            script.remove();
            this.pending = undefined;
            this.state = 'failed';
            this.update();
        };
        script.addEventListener('load', loaded, { once: true });
        script.addEventListener('error', failed, { once: true });
        this.doc.head.append(script);
    }
}
/** A view owns a subscription, while the guarded deployed runtime belongs to its document. */
export class ImproveItEmbed {
    doc;
    win;
    runtime;
    destroyed = false;
    owner;
    config;
    configKey;
    constructor(doc, win, config, ready, failed = () => undefined, status = () => undefined, eligible = () => true) {
        this.doc = doc;
        this.win = win;
        this.config = Object.freeze({
            app: config.app,
            space: config.space,
            screen: config.screen ?? 'app',
            origins: Object.freeze([...config.origins]),
        });
        this.configKey = feedbackConfigKey(this.config);
        this.owner = {
            enabled: false,
            epoch: 0,
            eligible,
            notify: (isReady, isFailed, available, loading) => {
                ready(isReady);
                failed(isFailed);
                status(available, loading);
            },
        };
    }
    setEnabled(enabled) {
        if (this.destroyed)
            return;
        if (!enabled)
            this.owner.epoch++;
        this.owner.enabled =
            enabled && this.config.origins.includes(this.win.location.origin);
        if (this.owner.enabled && !this.runtime) {
            let runtime = runtimes.get(this.doc);
            if (!runtime) {
                runtime = new DocumentWidget(this.doc, this.win, this.config);
                runtimes.set(this.doc, runtime);
            }
            // One product/origin policy per document. Unsupported structural changes fail closed.
            if (runtime.configKey === this.configKey) {
                this.runtime = runtime;
                runtime.owners.add(this.owner);
            }
        }
        if (this.runtime)
            this.runtime.update();
        else
            this.owner.notify(false, false, false, false);
    }
    /** Synchronous host interruption; restoration never revives a queued activation. */
    cancel() {
        this.setEnabled(false);
    }
    open(trigger) {
        this.owner.trigger = trigger;
        if (this.owner.enabled && !this.destroyed)
            this.runtime?.activate(this.owner);
    }
    retry(trigger) {
        this.owner.trigger = trigger;
        // One explicit attempt per click; route changes and failed downloads never loop.
        if (this.owner.enabled && !this.destroyed)
            this.runtime?.activate(this.owner, true);
    }
    destroy() {
        if (this.destroyed)
            return;
        this.destroyed = true;
        this.owner.enabled = false;
        this.owner.notify(false, false, false, false);
        this.runtime?.owners.delete(this.owner);
        this.runtime?.update();
    }
}
