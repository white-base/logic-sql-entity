const COLUMN_DATA_TYPE_REGEX = [
    /^varchar\(\d+\)$/,
    /^char\(\d+\)$/,
    /^decimal\(\d+, \d+\)$/,
    /^numeric\(\d+, \d+\)$/,
    /^binary\(\d+\)$/,
    /^datetime\(\d+\)$/,
    /^time\(\d+\)$/,
    /^timetz\(\d+\)$/,
    /^timestamp\(\d+\)$/,
    /^timestamptz\(\d+\)$/,
    /^varbinary\(\d+\)$/,
];

let dataType = "numeric(18,2)";

COLUMN_DATA_TYPE_REGEX.some((r) => { 
        // return r.test(dataType); 
        console.log('Testing', r, r.test(dataType));
        return r.test(dataType);
});

// if (COLUMN_DATA_TYPE_REGEX.some((r) => { 
//         // return r.test(dataType); 
//     })) {
//     return true;
// }