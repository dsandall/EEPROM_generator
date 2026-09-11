/**
 * SOES EEPROM generator
 * EEPROM .bin / .hex code generation logic

* This tool serves as:
- EtherCAT Slave Information XML + EEPROM binary generator
- SOES code generator

 * Victor Sluiter 2013-2018
 * Kuba Buda 2020-2024
 */
'use strict'

// ####################### EEPROM generating ####################### //

function hex_generator(form, stringOnly=false, od=null)
{
	//WORD ADDRESS 0-7
	let record = getConfigDataBytes(form);
	if (stringOnly) { return getConfigDataString(record, form.ESC.value); }

	/** Takes form, returns config data: 
	 * first 16 bytes (8 words) with check sum */
	function getConfigDataBytes(form) {
		const recordLength = parseInt(form.EEPROMsize.value);
		let record = new Uint8Array(recordLength);
		record.fill(0xFF);
		//Start of EEPROM contents; A lot of information can be found in 5.4 of ETG1000.6
		let pdiControl = 0x05;
		const spiMode = parseInt(form.SPImode.value);  // valid values ara 0, 1, 2 or 3
		let reserved_0x05 = 0x0000; 

		switch(form.ESC.value)  {
			case SupportedESC.AX58100: 
				reserved_0x05 = 0x001A; // enable IO for SPI driver on AX58100:
			    // Write 0x1A value (INT edge pulse length, 8 mA Control + IO 9:0 Drive Select) to 0x0A (Host Interface Extend Setting and Drive Strength
				break;
			case SupportedESC.LAN9252: 
				pdiControl = 0x80;
				break;
			case SupportedESC.LAN9253_Beckhoff: 
				reserved_0x05 = 0xC040; // enable ERRLED, STATE_RUNLED and MI Write 
				// in ASIC CONFIGURATION REGISTER: 0142h-0143h (refer to DS00003421A-page 268)
				break;
			case SupportedESC.LAN9253_Direct: 
				pdiControl = 0x82;
				reserved_0x05 = 0xC040; // enable ERRLED, STATE_RUNLED and MI Write 
				// in ASIC CONFIGURATION REGISTER: 0142h-0143h (refer to DS00003421A-page 268)
				break;
			case SupportedESC.LAN9253_Indirect: 
				pdiControl = 0x80;
				reserved_0x05 = 0xC040; // enable ERRLED, STATE_RUNLED and MI Write 
				// in ASIC CONFIGURATION REGISTER: 0142h-0143h (refer to DS00003421A-page 268)
				break;
			default:
				break;
		}
		
		//WORD ADDRESS 0-7
		writeEEPROMbyte_byteaddress(pdiControl, 0, record);    // PDI control: SPI slave (mapped to register 0x0140)
		writeEEPROMbyte_byteaddress(0x06,       1, record);    // ESC configuration: Distributed clocks Sync Out and Latch In enabled (mapped register 0x0141)
		writeEEPROMbyte_byteaddress(spiMode,    2, record);    // SPI mode (mapped to register 0x0150)
		writeEEPROMbyte_byteaddress(0x44,       3, record);    // SYNC /LATCH configuration (mapped to 0x0151). Make both Syncs output
		writeEEPROMword_wordaddress(0x0064,     2, record);    // Syncsignal Pulselenght in 10ns units(mapped to 0x0982:0x0983)
		writeEEPROMword_wordaddress(0x00,       3, record);    // Extended PDI configuration (none for SPI slave)(0x0152:0x0153)
		writeEEPROMword_wordaddress(0x00,       4, record);    // Configured Station Alias (0x0012:0x0013)
		writeEEPROMword_wordaddress(reserved_0x05,5, record);  // Reserved, 0 (when not AX58100, LAN9253/4/5)
		writeEEPROMword_wordaddress(0,          6, record);    // Reserved, 0
		const crc = FindCRC(record, 14);
		writeEEPROMword_wordaddress(crc,    7, record);        // CRC
		
		return record;
	}

	//WORD ADDRESS 8-15
	const VendorID =        parseInt(form.VendorID.value)
	const ProductCode =     parseInt(form.ProductCode.value)
	const RevisionNumber =  parseInt(form.RevisionNumber.value)
	const SerialNumber =    parseInt(form.SerialNumber.value)
	const RxMailboxOffset = parseInt(form.RxMailboxOffset.value);
	const MailboxSize =     parseInt(form.MailboxSize.value);
	const TxMailboxOffset = parseInt(form.TxMailboxOffset.value);
	const EEPROMsize = (Math.floor(parseInt(form.EEPROMsize.value) / 128)) - 1;

	writeEEPROMDword_wordaddress(VendorID,      8, record); // CoE 0x1018:01
	writeEEPROMDword_wordaddress(ProductCode,   10,record); // CoE 0x1018:02
	writeEEPROMDword_wordaddress(RevisionNumber,12,record); // CoE 0x1018:03
	writeEEPROMDword_wordaddress(SerialNumber,  14,record); // CoE 0x1018:04
	//WORD ADDRESS 16-23
	writeEEPROMword_wordaddress(0,              16, record); // Execution Delay Time; units?
	writeEEPROMword_wordaddress(0,              17, record); // Port0 Delay Time; units?
	writeEEPROMword_wordaddress(0,              18, record); // Port1 Delay Time; units?
	writeEEPROMword_wordaddress(0,              19, record); // Reserved, zero
	
	if (form.DetailsEnableUseFoE.checked) {						  // Set standard values to bootstrap mailbox settings
		writeEEPROMword_wordaddress(RxMailboxOffset, 20, record); // Bootstrap Rx mailbox offset
		writeEEPROMword_wordaddress(MailboxSize,     21, record); // Bootstrap Rx mailbox size
		writeEEPROMword_wordaddress(TxMailboxOffset, 22, record); // Bootstrap Tx mailbox offset
		writeEEPROMword_wordaddress(MailboxSize,     23, record); // Bootstrap Tx mailbox size
	} else {							              		// Bootstrap disabled, set to 0s
		writeEEPROMword_wordaddress(0,               20, record); // Bootstrap Rx mailbox offset 
		writeEEPROMword_wordaddress(0,               21, record); // Bootstrap Rx mailbox size 
		writeEEPROMword_wordaddress(0,               22, record); // Bootstrap Tx mailbox offset 
		writeEEPROMword_wordaddress(0,               23, record); // Bootstrap Tx mailbox size 
	}

	//WORD ADDRESS 24-...
	writeEEPROMword_wordaddress(RxMailboxOffset,   24, record); // Standard Rx mailbox offset   
	writeEEPROMword_wordaddress(MailboxSize,       25, record); // Standard Rx mailbox size
	writeEEPROMword_wordaddress(TxMailboxOffset,   26, record); // Standard Tx mailbox offset
	writeEEPROMword_wordaddress(MailboxSize,       27, record); // Standard Tx mailbox size
	writeEEPROMword_wordaddress(getProtocols(form),28, record); // CoE and FoE protocols, see Table18 in ETG1000.6
	for (let count = 29; count <= 61; count++) {                // fill reserved area with zeroes
		writeEEPROMword_wordaddress(0,          count, record);
	}
	writeEEPROMword_wordaddress(EEPROMsize,        62, record); // EEPROM size
	writeEEPROMword_wordaddress(1,                 63, record); // Version
	////////////////////////////////////
	///    Vendor Specific Info	      //
	////////////////////////////////////
	
	//Strings
	let array_of_strings = [form.TextDeviceType.value, form.TextGroupType.value, form.ImageName.value, form.TextDeviceName.value];
	let offset = 0;
	offset = writeEEPROMstrings(record, 0x80, array_of_strings); //See ETG1000.6 Table20
	//General info
	offset = writeEEPROMgeneral_settings(form,offset,record); //See ETG1000.6 Table21
	//FMMU
	offset = writeFMMU(form,offset, record); //see Table 22 ETG1000.6
	//SyncManagers
	const rxPdos = getPdoDescriptions(od, '1C12', 2);
	const txPdos = getPdoDescriptions(od, '1C13', 3);
	offset = writeSyncManagers(form, offset, record, rxPdos, txPdos); //See Table 23 ETG1000.6
	if (od) {
		offset = writePdoCategory(0x32, txPdos, offset, record); // TxPDO
		offset = writePdoCategory(0x33, rxPdos, offset, record); // RxPDO
		writeEEPROMword_wordaddress(0xFFFF, offset / 2, record);
		writeEEPROMword_wordaddress(0x0000, (offset / 2) + 1, record);
	}
	//End of EEPROM contents
	
	return record;
	
	/** See ETG1000.6 Table20 for Category string */
	function writeEEPROMstrings(record, offset, a_strings)
	{
		let number_of_strings = a_strings.length;
		let total_string_data_length = 0;
		let length_is_even;
		for(let strcounter = 0; strcounter < number_of_strings ; strcounter++)
		{
			total_string_data_length += a_strings[strcounter].length //add length of strings
		}
		total_string_data_length += number_of_strings; //for each string a byte is needed to indicate the length
		total_string_data_length += 1; //for byte to give 'number of strings'
		if(total_string_data_length %2) //if length is even (ends at word boundary)
			length_is_even = false;
		else
			length_is_even = true;
		writeEEPROMword_wordaddress(0x000A, offset/2, record); //Type: STRING
		writeEEPROMword_wordaddress(Math.ceil(total_string_data_length/2), (offset/2) + 1, record); //write length of complete package
		offset += 4; //2 words written
		writeEEPROMbyte_byteaddress(number_of_strings, offset++, record);
		for(let strcounter = 0; strcounter < number_of_strings ; strcounter++)
		{
			writeEEPROMbyte_byteaddress(a_strings[strcounter].length, offset++, record);
			for(let charcounter = 0 ; charcounter < a_strings[strcounter].length ; charcounter++)
			{
				writeEEPROMbyte_byteaddress(a_strings[strcounter].charCodeAt(charcounter), offset++, record);
			}	
		}
		if(length_is_even == false)
		{
			writeEEPROMbyte_byteaddress(0, offset++, record);
		}
		return offset;
	}
	/** See ETG1000.6 Table21 */
	function writeEEPROMgeneral_settings(form,offset,record)
	{
		const General_category = 0x1E; // value: 30d
		const categorysize = 0x10;
		//Clear memory region
		for(let wordcount = 0; wordcount < categorysize + 2; wordcount++) {
			writeEEPROMword_wordaddress(0, (offset/2) + wordcount, record);
		}
		//write code 30, 'General type'. See ETG1000.6, Table 19
		writeEEPROMword_wordaddress(General_category, offset/2, record);
		//write length of General Category data
		writeEEPROMword_wordaddress(categorysize, 1+(offset/2), record);
		offset +=4;
		writeEEPROMbyte_byteaddress(2,offset++,record);//index to string for Group Info
		writeEEPROMbyte_byteaddress(3,offset++,record);//index to string for Image Name
		writeEEPROMbyte_byteaddress(1,offset++,record);//index to string for Device Order Number
		writeEEPROMbyte_byteaddress(4,offset++,record);//index to string for Device Name Information
		offset++; //byte 4 is reserved
		writeEEPROMbyte_byteaddress(getCOEdetails(form),offset++,record);//CoE Details
		writeEEPROMbyte_byteaddress(getEnableFoEBit(form),offset++,record); //Enable FoE 
		writeEEPROMbyte_byteaddress(0,offset++,record); //Enable EoE
		writeEEPROMbyte_byteaddress(0,offset++,record); //reserved
		writeEEPROMbyte_byteaddress(0,offset++,record); //reserved
		writeEEPROMbyte_byteaddress(0,offset++,record); //reserved
		writeEEPROMbyte_byteaddress(0,offset++,record); //flags (Bit0: Enable SafeOp, Bit1: Enable notLRW
		writeEEPROMword_wordaddress(0x0000, offset/2, record); //current consumption in mA
		offset += 2;
		writeEEPROMword_wordaddress(0x0000, offset/2, record); //2 pad bytes
		offset += 2;
		writeEEPROMword_wordaddress(getPhysicalPort(form), offset/2, record);
		offset += 2;
		offset += 14; //14 pad bytes
		return offset;
	}
	/** See ETG1000.6 Table 22 */
	function writeFMMU(form, offset, record)
	{
		const FMMU_category = 0x28 // 40d
		writeEEPROMword_wordaddress(FMMU_category,offset/2,record);
		offset += 2;
		const length = 2                                 //length = 2 word = 4bytes: 3 FMMU's + padding
														 //length = 1 word = 2bytes: 2 FMMU's.
		writeEEPROMword_wordaddress(length, offset/2, record);
		offset += 2;
		writeEEPROMbyte_byteaddress(1, offset++, record); //FMMU0 used for Outputs; see Table 22 ETG1000.6
		writeEEPROMbyte_byteaddress(2, offset++, record); //FMMU1 used for Inputs;  see Table 22 ETG1000.6
		writeEEPROMbyte_byteaddress(3, offset++, record); //FMMU2 used for Mailbox State
		writeEEPROMbyte_byteaddress(0, offset++, record); //padding, disable FMMU4 if exists
		
		return offset;
	}
	/** See Table 23 ETG1000.6 */
	function writeSyncManagers(form, offset, record, rxPdos, txPdos)
	{
		const SyncManager_category = 0x29 // 41d
		writeEEPROMword_wordaddress(SyncManager_category, offset/2, record); //SyncManager
		offset += 2;
		writeEEPROMword_wordaddress(0x10, offset/2, record); //size of structure category
		offset += 2;
		//SM0
		writeEEPROMword_wordaddress(parseInt(form.RxMailboxOffset.value),offset/2, record); //Physical start address
		offset += 2;
		writeEEPROMword_wordaddress(parseInt(form.MailboxSize.value),offset/2, record); //Physical size
		offset += 2;
		writeEEPROMbyte_byteaddress(0x26,offset++, record); //Mode of operation
		writeEEPROMbyte_byteaddress(0,offset++, record); //don't care
		writeEEPROMbyte_byteaddress(1,offset++, record); //Enable Syncmanager; bit0: enable, bit 1: fixed content, bit 2: virtual SyncManager, bit 3: Op Only
		writeEEPROMbyte_byteaddress(1,offset++, record); //SyncManagerType; 0: not used, 1: Mbx out, 2: Mbx In, 3: PDO, 4: PDI
		//SM1
		writeEEPROMword_wordaddress(parseInt(form.TxMailboxOffset.value),offset/2, record); //Physical start address
		offset += 2;
		writeEEPROMword_wordaddress(parseInt(form.MailboxSize.value),offset/2, record); //Physical size
		offset += 2;
		writeEEPROMbyte_byteaddress(0x22,offset++, record); //Mode of operation
		writeEEPROMbyte_byteaddress(0,offset++, record); //don't care
		writeEEPROMbyte_byteaddress(1,offset++, record); //Enable Syncmanager; bit0: enable, bit 1: fixed content, bit 2: virtual SyncManager, bit 3: Op Only
		writeEEPROMbyte_byteaddress(2,offset++, record); //SyncManagerType; 0: not used, 1: Mbx out, 2: Mbx In, 3: PDO, 4: PDI
		//SM2
		writeEEPROMword_wordaddress(parseInt(form.SM2Offset.value),offset/2, record); //Physical start address
		offset += 2;
		writeEEPROMword_wordaddress(getPdoByteSize(rxPdos),offset/2, record); //Physical size
		offset += 2;
		writeEEPROMbyte_byteaddress(0x64,offset++, record); //Mode of operation: buffered, ECAT write, PDI IRQ, watchdog trigger
		writeEEPROMbyte_byteaddress(0,offset++, record); //don't care
		writeEEPROMbyte_byteaddress(1,offset++, record); //Enable Syncmanager; bit0: enable, bit 1: fixed content, bit 2: virtual SyncManager, bit 3: Op Only
		writeEEPROMbyte_byteaddress(3,offset++, record); //SyncManagerType; 0: not used, 1: Mbx out, 2: Mbx In, 3: PDO, 4: PDI
		//SM3
		writeEEPROMword_wordaddress(parseInt(form.SM3Offset.value),offset/2, record); //Physical start address
		offset += 2;
		writeEEPROMword_wordaddress(getPdoByteSize(txPdos),offset/2, record); //Physical size
		offset += 2;
		writeEEPROMbyte_byteaddress(0x20,offset++, record); //Mode of operation
		writeEEPROMbyte_byteaddress(0,offset++, record); //don't care
		writeEEPROMbyte_byteaddress(1,offset++, record); //Enable Syncmanager; bit0: enable, bit 1: fixed content, bit 2: virtual SyncManager, bit 3: Op Only
		writeEEPROMbyte_byteaddress(4,offset++, record); //SyncManagerType; 0: not used, 1: Mbx out, 2: Mbx In, 3: PDO, 4: PDI
		return offset;
	}

	/** Build the SII PDO category model from the generated CoE dictionary. */
	function getPdoDescriptions(od, assignmentIndex, syncManager)
	{
		if (!od || !od[assignmentIndex]) {
			return [];
		}

		return od[assignmentIndex].items.slice(1).map(assignment => {
			const index = parseInt(assignment.value);
			const mapping = od[indexToString(index)];
			if (!mapping) {
				throw new Error(`PDO assignment 0x${assignmentIndex} references missing object 0x${indexToString(index)}`);
			}
			return {
				index: index,
				syncManager: syncManager,
				entries: mapping.items.slice(1).map(item => getPdoEntry(od, item.value)),
			};
		});
	}

	function getPdoEntry(od, mappingValue)
	{
		const value = parseInt(mappingValue);
		const index = (value >>> 16) & 0xFFFF;
		const subindex = (value >>> 8) & 0xFF;
		const bitLength = value & 0xFF;

		if (index == 0) {
			return { index, subindex, bitLength, dataType: 0 };
		}

		const object = od[indexToString(index)];
		if (!object) {
			throw new Error(`PDO mapping references missing object 0x${indexToString(index)}`);
		}

		let dtype = object.dtype;
		if (object.otype != OTYPE.VAR) {
			const subitem = object.items[subindex];
			if (!subitem) {
				throw new Error(`PDO mapping references missing object 0x${indexToString(index)}:${subindex}`);
			}
			dtype = subitem.dtype || object.dtype;
		}

		return { index, subindex, bitLength, dataType: getSiiDataType(dtype) };
	}

	function getSiiDataType(dtype)
	{
		const dataTypes = {
			BOOLEAN: 0x01,
			INTEGER8: 0x02,
			INTEGER16: 0x03,
			INTEGER32: 0x04,
			UNSIGNED8: 0x05,
			UNSIGNED16: 0x06,
			UNSIGNED32: 0x07,
			REAL32: 0x08,
			VISIBLE_STRING: 0x09,
			REAL64: 0x11,
			INTEGER64: 0x15,
			UNSIGNED64: 0x1B,
		};
		const value = dataTypes[dtype];
		if (value == undefined) {
			throw new Error(`Unsupported SII PDO data type ${dtype}`);
		}
		return value;
	}

	function getPdoByteSize(pdos)
	{
		const bits = pdos.reduce((total, pdo) =>
			total + pdo.entries.reduce((pdoTotal, entry) => pdoTotal + entry.bitLength, 0), 0);
		return Math.ceil(bits / 8);
	}

	/** See ETG1000.6 PDO category definitions. */
	function writePdoCategory(category, pdos, offset, record)
	{
		if (!pdos.length) {
			return offset;
		}

		const categorySize = 4 + pdos.reduce((size, pdo) => size + 8 + (pdo.entries.length * 8), 0);
		if (offset + categorySize + 4 > record.length) {
			throw new Error(`EEPROM size ${record.length} is too small for generated SII categories`);
		}

		const categoryStart = offset;
		writeEEPROMword_wordaddress(category, offset / 2, record);
		offset += 4; // reserve category type and length

		pdos.forEach(pdo => {
			writeEEPROMword_wordaddress(pdo.index, offset / 2, record);
			offset += 2;
			writeEEPROMbyte_byteaddress(pdo.entries.length, offset++, record);
			writeEEPROMbyte_byteaddress(pdo.syncManager, offset++, record);
			writeEEPROMbyte_byteaddress(0, offset++, record); // DC Sync
			writeEEPROMbyte_byteaddress(0, offset++, record); // name string index
			writeEEPROMword_wordaddress(0, offset / 2, record); // flags
			offset += 2;

			pdo.entries.forEach(entry => {
				writeEEPROMword_wordaddress(entry.index, offset / 2, record);
				offset += 2;
				writeEEPROMbyte_byteaddress(entry.subindex, offset++, record);
				writeEEPROMbyte_byteaddress(0, offset++, record); // name string index
				writeEEPROMbyte_byteaddress(entry.dataType, offset++, record);
				writeEEPROMbyte_byteaddress(entry.bitLength, offset++, record);
				writeEEPROMword_wordaddress(0, offset / 2, record); // flags
				offset += 2;
			});
		});

		writeEEPROMword_wordaddress((offset - categoryStart - 4) / 2, (categoryStart / 2) + 1, record);
		return offset;
	}
	function getCOEdetails(form)
	{
		let coedetails = 0;
		if(form.CoeDetailsEnableSDO.checked) coedetails |= 0x01; 	//Enable SDO
		if(form.CoeDetailsEnableSDOInfo.checked) coedetails |= 0x02;	//Enable SDO Info
		if(form.CoeDetailsEnablePDOAssign.checked) coedetails |= 0x04;	//Enable PDO Assign
		if(form.CoeDetailsEnablePDOConfiguration.checked) coedetails |= 0x08;	//Enable PDO Configuration
		if(form.CoeDetailsEnableUploadAtStartup.checked) coedetails |= 0x10;	//Enable Upload at startup
		if(form.CoeDetailsEnableSDOCompleteAccess.checked) coedetails |= 0x20;	//Enable SDO complete access
		return coedetails;
	}
	/** ETG1000.6 Table 21 */
	function getPhysicalPort(form)
	{
		let portinfo = 0;
		let physicals = [form.Port3Physical.value, form.Port2Physical.value, form.Port1Physical.value, form.Port0Physical.value];
		for (let physicalcounter = 0; physicalcounter < physicals.length ; physicalcounter++)
		{
			portinfo = (portinfo << 4); //shift previous result
			switch(physicals[physicalcounter])
			{
			case 'Y':
			case 'H':
				portinfo |= 0x01; //MII
				break;
			case 'K':
				portinfo |= 0x03; //EBUS
				break;
			default:
				portinfo |= 0; 	//No connection
			}
		}
		return portinfo;
	}

	/** computes crc value */
	function FindCRC(data,datalen) {
		let i,j;
		let c;
		let CRC=0xFF;
		const genPoly = 0x07;
		for (j=0; j<datalen; j++)
		{
			c = data[j];
			CRC ^= c;
			for(i = 0; i<8; i++)
				if(CRC & 0x80 )
				CRC = (CRC << 1) ^ genPoly;
				else
				CRC <<= 1;
			CRC &= 0xff;
		}
		return CRC;
	}
	
	function writeEEPROMbyte_byteaddress(byte, address, record)
	{
		record[address] = byte;
	}
	
	function writeEEPROMbyte_wordaddress(byte, address, record)
	{
		record[address*2] = byte;
	}
	
	function writeEEPROMword_wordaddress(word, address, record)
	{//little endian word storage!
		record[     address*2 ] = word&0xFF;
		record[1 + (address*2)] = (word>>8) & 0xFF;
	}
	
	function writeEEPROMDword_wordaddress(word, address, record)
	{//little endian word storage!
		record[     address*2 ] = word&0xFF;
		record[1 + (address*2)] = (word>>8) & 0xFF;
		record[2 + (address*2)] = (word>>16) & 0xFF;
		record[3 + (address*2)] = (word>>24) & 0xFF;
	}

	/** takes bytes array and count, returns ConfigData string */
	function getConfigDataString(record, esc) {
		const configdata_bytecount = configOnReservedBytes.has(esc) ? 14 : 8;

		let configdata = '';
		for (let bytecount = 0; bytecount < configdata_bytecount; bytecount++) {
			configdata += (record[bytecount] + 0x100).toString(16).slice(-2).toUpperCase();
		}
		return configdata;
	}

	// see Table18 in ETG1000.6
	// always enabled CoE = 0x04, optionally enable FoE
	function getProtocols(form) {
		return form.DetailsEnableUseFoE.checked ? 0x0C : 0x04
	}

	function getEnableFoEBit(form) {
		return form.DetailsEnableUseFoE.checked ? 1 : 0;
	}
	
}
