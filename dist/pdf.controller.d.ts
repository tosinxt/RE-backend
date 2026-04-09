export declare class PdfController {
    parsePdf(file?: Express.Multer.File): Promise<{
        text: string;
        totalPages: number;
    }>;
}
