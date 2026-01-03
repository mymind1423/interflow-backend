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

async function checkVersions(objectName) {
    const client = getClient();
    const namespace = process.env.OCI_NAMESPACE;
    const bucketName = process.env.OCI_BUCKET_NAME;

    console.log(`Checking versions for ${objectName}...`);

    try {
        const req = {
            namespaceName: namespace,
            bucketName: bucketName,
            objectName: objectName,
            limit: 10
            // fields: 'timeCreated,size'
        };
        // SDK Method for listing versions might be listObjectVersions
        // checking SDK capability... 
        // If listObjectVersions doesn't exist on client, we might be out of luck via this SDK version, but it should.

        const response = await client.listObjectVersions(req);

        if (response.listObjectVersions.items.length > 0) {
            console.log("VERSIONS FOUND:");
            response.listObjectVersions.items.forEach(v => {
                console.log(`- VersionId: ${v.versionId}, Size: ${v.size}, Time: ${v.timeCreated}`);
            });
        } else {
            console.log("No previous versions found.");
        }
    } catch (err) {
        console.log("Error listing versions (Versioning might be disabled):", err.message);
    }
}

checkVersions('avatars/mouad.jpg');
