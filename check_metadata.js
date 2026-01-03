import common from 'oci-common';
import os from 'oci-objectstorage';
import dotenv from 'dotenv';
dotenv.config();

function getClient() {
    const provider = new common.SimpleAuthenticationDetailsProvider(
        process.env.OCI_TENANCY,
        process.env.OCI_USER,
        process.env.OCI_FINGERPRINT,
        process.env.OCI_PRIVATE_KEY.replace(/\\n/g, '\n'),
        null,
        common.Region.fromRegionId(process.env.OCI_REGION)
    );
    return new os.ObjectStorageClient({ authenticationDetailsProvider: provider });
}

async function checkMetadata(objectName) {
    const client = getClient();
    const req = {
        namespaceName: process.env.OCI_NAMESPACE,
        bucketName: process.env.OCI_BUCKET_NAME,
        objectName: objectName
    };

    try {
        const head = await client.headObject(req);
        console.log(`\n--- Metadata for ${objectName} ---`);
        console.log(`Content-Length: ${head.contentLength}`);
        console.log(`Content-Type: ${head.contentType}`);
        console.log(`Content-Disposition: ${head.contentDisposition}`);
        console.log(`ETag: ${head.eTag}`);
    } catch (err) {
        console.error(`Error checking ${objectName}:`, err.message);
    }
}

// Check the PDF from screenshot and the avatar
checkMetadata('cv/anonymous-1766522100146.pdf');
checkMetadata('avatars/mouad.jpg');
