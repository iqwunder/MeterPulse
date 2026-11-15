import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { CategoryScale, Filler, LineController, LineElement, LinearScale, PointElement, Tooltip } from 'chart.js';
import { provideCharts } from 'ng2-charts';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideCharts({ registerables: [CategoryScale, Filler, LineController, LineElement, LinearScale, PointElement, Tooltip] }),
  ],
};
