
"use strict";

/**
 * Author: Terence Lee
 */


document.addEventListener('deviceready', onDeviceReady, false);


/**
 * The event handler for the deviceready event. Does the following:
 *      (a) Creates a QrCodeUrl if it does not exist
 *      (b) Display list of recently scanned QR code URLs
 *      (c) Initializes the onclick event for the scan-qr-code button
 */
async function onDeviceReady() {

  
    let sqliteDatabaseHandle = getSqliteDatabaseHandle();

    try{
        await createTableIfNotExistPromise(sqliteDatabaseHandle);

        let arrayOfRecentScannedUrls = await retrieveRecentListOfScannedUrlPromise(sqliteDatabaseHandle);
        
        displayLinksOfRecentScannedUrls(arrayOfRecentScannedUrls);

    }
    catch(error){
        alert(error)
    }


    document.getElementById('scan-qr-code-button').addEventListener('click', 
               ()=>onScanQrCodeButtonClick(sqliteDatabaseHandle));
}



/**
 * Returns a handle for this app's sqlite database
 * 
 */
function getSqliteDatabaseHandle(){

    return window.sqlitePlugin.openDatabase({name: 'qr_code_scanner.db',
                                            location: 'default'});
    
}


/**
 * Creates the table QrCodeUrl in the device sqlite database if it does not exist
 * 
 * @param {*} sqliteDatabaseHandle - a handle representing access to sqlite database
 * 
 * @returns a Promise. If the promise is fulfilled, the resulting value is undefined
 *          If the promise is rejected, the resulting value an string representing the error
 */
function createTableIfNotExistPromise(sqliteDatabaseHandle){

    return new Promise((resolve, reject)=>{

        sqliteDatabaseHandle.transaction(function(tx) {
            tx.executeSql(`CREATE TABLE IF NOT EXISTS QrCodeUrl (url TEXT)`);
    
          }, function(error) {
             
            reject("Device database error")

          }, function() {

            resolve()
    
          });
    })
    
}



/**
 * Retrieves an object containing a list of recent scanned Urls
 * 
 * The data from the fulfilled object can be iterated through  fulfilledObject.rows.item(index).url
 * 
 * E.g.  for (let index=0; fulfilledObject.rows.length; index++ ){
 *      console.log("The current url is " + fulfilledObject.row.item(index).url)
 * } 
 * 
 * @param {*} sqliteDatabaseHandle - a handle representing access to sqlite database
 * 
 * @returns a Promise. If the promise is fulfilled, then the resulting value is an object containing
 *          the list of recent urls (see above for usage). 
 *          If the promise is rejected, the resulting value is an string representing why
 *          the promise is rejected.
 */
function retrieveRecentListOfScannedUrlPromise(sqliteDatabaseHandle){

    return new Promise((resolve, reject)=>{

        sqliteDatabaseHandle.transaction(function(tx) {
            
            tx.executeSql('SELECT url FROM QrCodeUrl ORDER BY rowid DESC LIMIT 5', [], 
                    function (tx, results){

                        resolve(results);
                    });

          }, function(error) {
    
            reject("Device database error");
          });

    })

}

/**
 * Display a list of links containing recently scanned QR code Urls.
 * 
 * The links can be accessed from the recentScannedUrlResults through
 *  recentScannedUrlResults.rows.item(index).url
 * 
 * E.g.  for (let index=0; recentScannedUrlResults.rows.length; index++ ){
 *      console.log("The current url is " + recentScannedUrlsObject.row.item(index).url)
 * 
 * However, if recentScannedUrlResults does not contain any recent urls, it
 *  will display a message saying so
 * 
 * @param {*} recentScannedUrlResults 
 */
function displayLinksOfRecentScannedUrls(recentScannedUrlResults){


    let displayHtml = "";

    for(let i=0; i < recentScannedUrlResults.rows.length; i++){

        displayHtml += `<a href="${recentScannedUrlResults.rows.item(i).url}"
                            class="d-block my-4 fs-4">
                            ${recentScannedUrlResults.rows.item(i).url}</a>`
    }


    if (recentScannedUrlResults.rows.length == 0){
        displayHtml = `<div class='mt-4 fs-4 text-danger'>There are no recent QR Code 
                                links.</div>`
    }

    document.getElementById('recent-qr-code-links-container').innerHTML = displayHtml;
}



/**
 * The event handler for the button click event for the scan qr code button
 * 
 * @param {*} sqliteDatabaseHandle - a handle representing access to sqlite database
 */
async function onScanQrCodeButtonClick(sqliteDatabaseHandle){

    try{
           
        let url = await scanQrCodePromise();
       
       await insertUrlIntoDatabaseAndDeleteExcessPromise(sqliteDatabaseHandle, url);

       let arrayOfRecentScannedUrls = await retrieveRecentListOfScannedUrlPromise(sqliteDatabaseHandle);

       displayLinksOfRecentScannedUrls(arrayOfRecentScannedUrls);

       promptUserToOpenUrlInBrowser(url);
   }
   catch(error){

       alert(error);
   }
}




/**
 * Activates the third-party library plugin to scan for a valid QR code
 * 
 * 
 * @returns a Promise. If the promise is fulfilled, the resulting value is the URL(string) of the qr code.
 *          If the promise is rejected, the resulting value is a string describing the error
 */
function scanQrCodePromise(){

    return new Promise((resolve, reject)=>{

        cordova.plugins.barcodeScanner.scan(
            function (result) {
                
                if (result.cancelled){
                    reject("The scan was cancelled.");
                }

                resolve(result.text)
                
            },
            function (error) {
                
                reject(error);

            },{
                preferFrontCamera : false, // iOS and Android
                showFlipCameraButton : true, // iOS and Android
                showTorchButton : true, // iOS and Android
                torchOn: true, // Android, launch with the torch switched on (if available)
                saveHistory: true, // Android, save scan history (default false)
                prompt : "Place qr code inside the scan area", // Android
                resultDisplayDuration: 500, // Android, display scanned text for X ms. 0 suppresses it entirely, default 1500
                disableAnimations : true, // iOS
                disableSuccessBeep: false, // iOS and Android
                formats : "QR_CODE"  // default: all but PDF_417 and RSS_EXPANDED
            }
         );
    }); 
   
    
}




/**
 * Insert a url into the QrCodeUrl table. Next, delete all records except
 * the latest 5 records from the QrCodeUrl table
 * 
 * @param {*} sqliteDatabaseHandle - a handle representing access to sqlite database
 * 
 * @param {*} url - the url to be inserted into database
 * 
 * @returns a Promise. If promise is fulfilled/resolved , the resulting value is undefined.
 *          If the promise is rejected, then the resulting value is a string describing the error
 */
function insertUrlIntoDatabaseAndDeleteExcessPromise(sqliteDatabaseHandle, url){

    return new Promise((resolve, reject)=>{

        sqliteDatabaseHandle.transaction(function(tx) {
            
            tx.executeSql('INSERT INTO QrCodeUrl VALUES (?1)', [url]);

            //keep the latest 15 url records, and delete the rest
            //to prevent the database from growing too big
            tx.executeSql(`DELETE FROM QrCodeUrl WHERE rowid NOT IN  
                                (SELECT rowid from QrCodeUrl 
                                 ORDER BY rowid DESC
                                 LIMIT 5)`)
            
          }, function(error) {

            reject("Device database error")

          }, function() {

            resolve()

          });
    });

    
}



/**
 * Prompts (Ask) the user whether to open the URL in a new browser window.
 * If the user clicks yes, then open in new window. If no, then nothing happens
 * 
 * @param {*} url - the url to be opened in a new browser window
 */
function promptUserToOpenUrlInBrowser(url){

    let wishToOpen = confirm(
        `The link scanned is ${url}. Do you wish to open the link in a new browser window?`);

    if (wishToOpen){
        window.open(url, "_blank");
    }

}
