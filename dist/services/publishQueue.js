const MAX_CONCURRENT_JOBS = 5;
let running = 0;
const queue = [];
function drain() {
    while (running < MAX_CONCURRENT_JOBS &&
        queue.length > 0) {
        const item = queue.shift();
        if (!item) {
            break;
        }
        running++;
        Promise.resolve()
            .then(() => item.job())
            .then((value) => {
            item.resolve(value);
        }, (error) => {
            item.reject(error);
        })
            .finally(() => {
            running--;
            drain();
        });
    }
}
export function enqueuePublish(job) {
    return new Promise((resolve, reject) => {
        queue.push({
            job,
            resolve,
            reject
        });
        drain();
    });
}
export function getPublishQueueStats() {
    return {
        running,
        queued: queue.length,
        maxConcurrent: MAX_CONCURRENT_JOBS
    };
}
