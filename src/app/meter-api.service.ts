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

export interface PvFeedInContract {
    grossPricePerKwh: number | string;
    vatRate: number | string;
}

export interface PvUtilityPayment {
    year: number;
    month: number;
    receivedGross: number | string | null;
}

export interface UtilityContract {
    utility: Utility;
    contractStart: string;
    monthlyFee: number | string;
    unitPrice: number | string;
    heatingValue: number | string | null;
    conditionNumber: number | string | null;
    wastewaterPrice: number | string | null;
    rainwaterPricePerSqm: number | string | null;
    sealedAreaSqm: number | string | null;
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

    getPvContract(): Observable<PvFeedInContract | null> {
        return this.http.get<PvFeedInContract | null>('/api/pv-contract')
            .pipe(catchError((error) => this.handleError(error)));
    }

    savePvContract(contract: PvFeedInContract): Observable<PvFeedInContract> {
        return this.http.put<PvFeedInContract>('/api/pv-contract', contract)
            .pipe(catchError((error) => this.handleError(error)));
    }

    getPvPayments(year: number): Observable<PvUtilityPayment[]> {
        return this.http.get<PvUtilityPayment[]>(`/api/pv-payments?year=${year}`)
            .pipe(catchError((error) => this.handleError(error)));
    }

    savePvPayment(year: number, month: number, receivedGross: number | null): Observable<PvUtilityPayment> {
        return this.http.put<PvUtilityPayment>(`/api/pv-payments/${year}/${month}`, { receivedGross })
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