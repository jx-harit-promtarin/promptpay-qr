import { bootstrapApplication } from '@angular/platform-browser';
import "zone.js";
import { AppComponent } from './app/app.component';

function isBenignPlayPauseAbortError(reason: unknown): boolean {
	const anyReason = reason as any;
	const name = anyReason?.name;
	const message = String(anyReason?.message ?? '');
	return name === 'AbortError' && /play\(\)/i.test(message) && /pause\(\)/i.test(message);
}

globalThis.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
	if (isBenignPlayPauseAbortError(event.reason)) {
		event.preventDefault();
	}
});

bootstrapApplication(AppComponent).catch(err => console.error(err));
