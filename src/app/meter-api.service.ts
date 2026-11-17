import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';

export type Utility = 'electricity' | 'gas' | 'water';

export interface Reading {
    id: number;
    utility: Utility;
    value: number | string;
    unit: string;
    recordedAt: string;
}

export interface PvReading {
    date: string;
    generated: number | string;
    consumed: number | string;
    feedIn: number | string;
    gridImport: number | string;
}

export interface UtilityContract {
    utility: Utility;
    contractStart: string;
    monthlyFee: number | string;
    unitPrice: number | string;
    monthlyAdvance: number | string;
    contractEnd: string | null;
}

export type NewReading = Omit<Reading, 'id'>;

@Injectable({ providedIn: 'root' })
export class MeterApiService {
    private readonly http = inject(HttpClient);
    private readonly baseUrl = '/api/readings';

    getReadings(): Observable<Reading[]> {
        return this.http.get<Reading[]>(this.baseUrl).pipe(catchError((error) => this.handleError(error)));
    }

    addReading(reading: NewReading): Observable<Reading> {
        return this.http.post<Reading>(this.baseUrl, reading).pipe(catchError((error) => this.handleError(error)));
    }

    importCsv(file: File): Observable<{ imported: number }> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post<{ imported: number }>(`${this.baseUrl}/import`, formData)
            .pipe(catchError((error) => this.handleError(error)));
    }

    getPvReadings(): Observable<PvReading[]> {
        return this.http.get<PvReading[]>('/api/pv-readings').pipe(catchError((error) => this.handleError(error)));
    }

    importPvCsv(file: File): Observable<{ imported: number }> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post<{ imported: number }>('/api/pv-readings/import', formData)
            .pipe(catchError((error) => this.handleError(error)));
    }

    getContracts(): Observable<UtilityContract[]> {
        return this.http.get<UtilityContract[]>('/api/contracts').pipe(catchError((error) => this.handleError(error)));
    }

    saveContract(contract: UtilityContract): Observable<UtilityContract> {
        return this.http.put<UtilityContract>(`/api/contracts/${contract.utility}`, contract)
            .pipe(catchError((error) => this.handleError(error)));
    }

    private handleError(error: HttpErrorResponse): Observable<never> {
        const message = typeof error.error?.error === 'string'
            ? error.error.error
            : error.status === 0
                ? 'Die API ist nicht erreichbar. Starte Backend und MariaDB und versuche es erneut.'
                : 'Die Anfrage konnte nicht verarbeitet werden.';
        return throwError(() => new Error(message));
    }
}