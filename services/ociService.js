import common from 'oci-common';
import os from 'oci-objectstorage';
import dotenv from 'dotenv';
import mime from 'mime-types';

dotenv.config();

let provider = null;
let objectStorageClient = null;

function initOCI() {
    if (objectStorageClient) return objectStorageClient;

    try {
        const tenancy = process.env.OCI_TENANCY;
        const user = process.env.OCI_USER;
        const fingerprint = process.env.OCI_FINGERPRINT;
        const privateKey = process.env.OCI_PRIVATE_KEY.replace(/\\n/g, '\n');
        const region = process.env.OCI_REGION;

        if (!tenancy || !user || !fingerprint || !privateKey || !region) {
            console.error("Missing OCI Environment Variables");
            return null;
        }

        provider = new common.SimpleAuthenticationDetailsProvider(
            tenancy,
            user,
            fingerprint,
            privateKey,
            null,
            common.Region.fromRegionId(region)
        );

        objectStorageClient = new os.ObjectStorageClient({ authenticationDetailsProvider: provider });
        console.log("OCI Object Storage Configured");
        return objectStorageClient;
    } catch (error) {
        console.error("Error initializing OCI:", error);
        return null;
    }
}

export async function uploadToBucket(fileBuffer, fileName, folder = 'uploads') {
    const client = initOCI();
    if (!client) throw new Error("OCI Client not initialized");

    const namespace = process.env.OCI_NAMESPACE;
    const bucketName = process.env.OCI_BUCKET_NAME;

    if (!namespace || !bucketName) throw new Error("Missing OCI Bucket Config");

    const objectName = `${folder}/${fileName}`;

    // Determine Content-Type
    const contentType = mime.lookup(fileName) || 'application/octet-stream';

    // Upload
    const putObjectRequest = {
        namespaceName: namespace,
        bucketName: bucketName,
        objectName: objectName,
        putObjectBody: fileBuffer,
        contentType: contentType
    };

    try {
        await client.putObject(putObjectRequest);

        // Construct Public URL (Assuming Standard Object Storage Public Bucket)
        // Format: https://objectstorage.{region}.oraclecloud.com/n/{namespace}/b/{bucket}/o/{objectName}
        // Note: Object name needs encoding if it has special chars, but usually minimal

        // We need region for URL
        const region = process.env.OCI_REGION;

        // Ensure object name is URL encoded properly for path
        const encodedObjectName = encodeURIComponent(objectName).replace(/%2F/g, '/'); // Keep slashes for folder structure

        const url = `https://objectstorage.${region}.oraclecloud.com/n/${namespace}/b/${bucketName}/o/${encodedObjectName}`;
        return url;

    } catch (error) {
        console.error("OCI Upload Error:", error);
        throw error;
    }
}
