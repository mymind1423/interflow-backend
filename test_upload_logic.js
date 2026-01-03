import { uploadToBucket } from './services/ociService.js';
import path from 'path';

async function testUpload() {
    console.log("Starting Test Upload...");

    // mimic a file buffer (PDF)
    const buffer = Buffer.from("%PDF-1.5 %... Dummy Content", 'utf-8'); // Minimal PDF header
    const originalName = "test_manual_upload.pdf";
    const filename = `test-user-${Date.now()}.pdf`; // Simulate controller logic

    try {
        const url = await uploadToBucket(buffer, filename, "test-uploads");
        console.log("Upload Success! URL:", url);

        // We should verify metadata immediately (can reuse check_metadata logic or manual)
        // Check if URL looks correct
        if (!url.includes(filename)) {
            console.error("FAILURE: URL does not contain generated filename.");
        } else {
            console.log("SUCCESS: Filename logic OK.");
        }

    } catch (err) {
        console.error("Upload Failed:", err);
    }
}

testUpload();
