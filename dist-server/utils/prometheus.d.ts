export declare function queryPrometheus(promql: string): Promise<any>;
export declare function extractScalar(data: any): number;
export declare function getSystemMetrics(): Promise<{
    ram: {
        total: number;
        used: number;
        percent: number;
    };
    cpu: {
        percent: number;
    };
    disk: {
        total: number;
        used: number;
        percent: number;
    };
    load: number;
}>;
