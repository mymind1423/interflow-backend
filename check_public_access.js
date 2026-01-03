import https from 'https';

const url = "https://objectstorage.me-jeddah-1.oraclecloud.com/n/ax9efe9xa6au/b/bucket-backup/o/cv%2Fanonymous-1766522100146.pdf";

console.log(`Checking public access: ${url}`);

https.get(url, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    if (res.statusCode === 200) {
        console.log("SUCCESS: File is public.");
    } else {
        console.log("FAILURE: File is NOT accessible (likely Private Bucket).");
    }
}).on('error', (e) => {
    console.error(e);
});
