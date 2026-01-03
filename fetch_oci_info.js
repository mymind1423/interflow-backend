import common from 'oci-common';
import os from 'oci-objectstorage';
import fs from 'fs';

async function run() {
    try {
        const privateKey = fs.readFileSync('./oci_key.pem', 'utf8');

        const provider = new common.SimpleAuthenticationDetailsProvider(
            "ocid1.tenancy.oc1..aaaaaaaa7bi5njsphp4wep3ukq4p6ut5upg6r4r6e6hkksskaanu624wjynq",
            "ocid1.user.oc1..aaaaaaaa5hhmtj5acquusio2p5i76w3ee2fjk6zximsilna2svn7oyb2njhq",
            "ad:72:e2:91:65:3a:8a:db:a2:70:d6:99:1c:a0:f2:30",
            privateKey,
            null,
            common.Region.fromRegionId("me-jeddah-1")
        );

        const client = new os.ObjectStorageClient({ authenticationDetailsProvider: provider });

        console.log("Getting Namespace...");
        const nsResponse = await client.getNamespace({});
        const namespace = nsResponse.value;
        console.log(`NAMESPACE: ${namespace}`);

        console.log("Listing Buckets...");
        const bucketsResponse = await client.listBuckets({
            namespaceName: namespace,
            compartmentId: "ocid1.tenancy.oc1..aaaaaaaa7bi5njsphp4wep3ukq4p6ut5upg6r4r6e6hkksskaanu624wjynq" // Usually compartment is tenancy for root
        });

        console.log("BUCKETS:");
        bucketsResponse.items.forEach(b => console.log(`- ${b.name}`));

    } catch (e) {
        console.error("Error:", e);
    }
}

run();
