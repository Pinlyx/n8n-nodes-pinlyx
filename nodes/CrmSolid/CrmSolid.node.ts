import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IRequestOptions,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

/**
 * One call against the Pinlyx public API.
 *
 * Everything goes through n8n's own request helper rather than a bundled HTTP
 * client, both because the credential injects the Authorization header there and
 * because a verified community node is not allowed runtime dependencies.
 */
async function crmSolidRequest(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	resource: string,
	body: IDataObject = {},
	qs: IDataObject = {},
): Promise<any> {
	const credentials = await this.getCredentials('crmSolidApi');
	const baseUrl = ((credentials.baseUrl as string) || 'https://api.crmsolid.com').replace(/\/+$/, '');

	const options: IRequestOptions = {
		method,
		qs,
		uri: `${baseUrl}${resource}`,
		json: true,
	};
	if (Object.keys(body).length) options.body = body;

	return this.helpers.requestWithAuthentication.call(this, 'crmSolidApi', options);
}

/**
 * Walks the cursor pagination the API uses.
 *
 * Every v1 list endpoint answers with the same envelope, `{ items, nextCursor,
 * hasMore }` (see V1ControllerBase.Page). `items` is the field that carries the
 * rows: reading `data` instead silently produced an empty result on every Get
 * Many, because the key simply does not exist. `data` is still accepted as a
 * fallback so a future envelope change does not break this in the other
 * direction.
 *
 * `cursorParam` exists because the cursor is not always called `after`.
 * Contacts and deals page forward on an id with `?after=`; conversations page
 * back through activity time with `?before=`. Sending the wrong name means the
 * server ignores it, returns page one again, and Return All never terminates.
 */
async function paginate(
	this: IExecuteFunctions,
	itemIndex: number,
	path: string,
	filters: IDataObject,
	cursorParam: 'after' | 'before' = 'after',
): Promise<IDataObject[]> {
	const returnAll = this.getNodeParameter('returnAll', itemIndex) as boolean;
	const limit = returnAll ? 100 : (this.getNodeParameter('limit', itemIndex) as number);

	const collected: IDataObject[] = [];
	let cursor: string | number | undefined;

	for (;;) {
		const remaining = returnAll ? 100 : limit - collected.length;
		const qs: IDataObject = { ...filters, limit: Math.min(Math.max(remaining, 1), 100) };
		if (cursor !== undefined) qs[cursorParam] = cursor;

		const page = await crmSolidRequest.call(this, 'GET', path, {}, qs);
		const rows: IDataObject[] =
			(page?.items as IDataObject[]) ??
			(page?.data as IDataObject[]) ??
			(Array.isArray(page) ? page : []);
		collected.push(...rows);

		const next = page?.nextCursor as string | number | null | undefined;
		cursor = next === null ? undefined : next;

		// `hasMore` is authoritative when present; fall back to the cursor for an
		// endpoint that returns a naturally complete set and no flag.
		const hasMore = typeof page?.hasMore === 'boolean' ? page.hasMore : cursor !== undefined;
		if (!hasMore || cursor === undefined || rows.length === 0) break;
		if (!returnAll && collected.length >= limit) break;
	}

	return returnAll ? collected : collected.slice(0, limit);
}

export class CrmSolid implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pinlyx',
		name: 'crmSolid',
		icon: 'file:crmsolid.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Work with contacts, deals and conversations in Pinlyx',
		defaults: { name: 'Pinlyx' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'crmSolidApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Contact', value: 'contact' },
					{ name: 'Conversation', value: 'conversation' },
					{ name: 'Deal', value: 'deal' },
				],
				default: 'contact',
			},

			// ------------------------------------------------------------- contact
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['contact'] } },
				options: [
					{ name: 'Create', value: 'create', description: 'Create a contact', action: 'Create a contact' },
					{ name: 'Delete', value: 'delete', description: 'Archive a contact', action: 'Delete a contact' },
					{ name: 'Get', value: 'get', description: 'Get a contact', action: 'Get a contact' },
					{ name: 'Get Many', value: 'getAll', description: 'List contacts', action: 'Get many contacts' },
					{ name: 'Update', value: 'update', description: 'Update a contact', action: 'Update a contact' },
				],
				default: 'create',
			},
			{
				displayName: 'Contact ID',
				name: 'contactId',
				type: 'number',
				required: true,
				default: 0,
				displayOptions: { show: { resource: ['contact'], operation: ['get', 'update', 'delete'] } },
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'At least one of name, username, phone, email or external ID has to be filled in',
				displayOptions: { show: { resource: ['contact'], operation: ['create'] } },
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['contact'], operation: ['create', 'update'] } },
				options: [
					{ displayName: 'Email', name: 'email', type: 'string', placeholder: 'name@email.com', default: '' },
					{
						displayName: 'External ID',
						name: 'externalId',
						type: 'string',
						default: '',
						description: 'Your own identifier for this person, which is what keeps a re-run from creating a duplicate',
					},
					{ displayName: 'Name', name: 'name', type: 'string', default: '' },
					{ displayName: 'Notes', name: 'notes', type: 'string', typeOptions: { rows: 3 }, default: '' },
					{ displayName: 'Phone', name: 'phone', type: 'string', default: '' },
					{
						displayName: 'Platform',
						name: 'platform',
						type: 'options',
						default: 'telegram',
						options: [
							{ name: 'Email', value: 'email' },
							{ name: 'Instagram', value: 'instagram' },
							{ name: 'LinkedIn', value: 'linkedin' },
							{ name: 'Telegram', value: 'telegram' },
							{ name: 'WhatsApp', value: 'whatsapp' },
							{ name: 'X (Twitter)', value: 'x' },
						],
					},
					{ displayName: 'Username', name: 'username', type: 'string', default: '' },
				],
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: { show: { resource: ['contact'], operation: ['getAll'] } },
				options: [
					{ displayName: 'Email', name: 'email', type: 'string', placeholder: 'name@email.com', default: '' },
					{ displayName: 'External ID', name: 'externalId', type: 'string', default: '' },
					{ displayName: 'Platform', name: 'platform', type: 'string', default: '' },
					{
						displayName: 'Search',
						name: 'q',
						type: 'string',
						default: '',
						description: 'Substring match on name, username, phone and external ID',
					},
					{
						displayName: 'Updated Since',
						name: 'updatedSince',
						type: 'dateTime',
						default: '',
						description: 'Only contacts changed at or after this instant, which is what an incremental sync runs on',
					},
				],
			},

			// ---------------------------------------------------------------- deal
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['deal'] } },
				options: [
					{ name: 'Create', value: 'create', description: 'Create a deal', action: 'Create a deal' },
					{ name: 'Get Many', value: 'getAll', description: 'List deals', action: 'Get many deals' },
				],
				default: 'create',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { resource: ['deal'], operation: ['create'] } },
			},
			{
				displayName: 'Additional Fields',
				name: 'dealFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { resource: ['deal'], operation: ['create'] } },
				options: [
					{ displayName: 'Contact ID', name: 'contactId', type: 'number', default: 0 },
					{ displayName: 'Currency', name: 'currency', type: 'string', default: 'USD', description: 'ISO-4217 code' },
					{ displayName: 'Expected Close At', name: 'expectedCloseAt', type: 'dateTime', default: '' },
					{ displayName: 'Notes', name: 'notes', type: 'string', typeOptions: { rows: 3 }, default: '' },
					{
						displayName: 'Probability',
						name: 'probability',
						type: 'number',
						default: 0,
						description: 'Percentage between 0 and 100',
					},
					{
						displayName: 'Stage',
						name: 'stage',
						type: 'options',
						default: 'lead',
						description: 'A deal cannot be created already won or lost',
						options: [
							{ name: 'Lead', value: 'lead' },
							{ name: 'Negotiation', value: 'negotiation' },
							{ name: 'Proposal', value: 'proposal' },
							{ name: 'Qualified', value: 'qualified' },
						],
					},
					{ displayName: 'Value', name: 'value', type: 'number', default: 0 },
				],
			},
			{
				displayName: 'Filters',
				name: 'dealFilters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: { show: { resource: ['deal'], operation: ['getAll'] } },
				options: [
					{ displayName: 'Contact ID', name: 'contactId', type: 'number', default: 0 },
					{
						displayName: 'Search',
						name: 'q',
						type: 'string',
						default: '',
						description: 'Substring match on the deal title',
					},
					{
						displayName: 'Stage',
						name: 'stage',
						type: 'options',
						default: 'lead',
						options: [
							{ name: 'Lead', value: 'lead' },
							{ name: 'Lost', value: 'lost' },
							{ name: 'Negotiation', value: 'negotiation' },
							{ name: 'Proposal', value: 'proposal' },
							{ name: 'Qualified', value: 'qualified' },
							{ name: 'Won', value: 'won' },
						],
					},
				],
			},

			// -------------------------------------------------------- conversation
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['conversation'] } },
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'List conversations across every connected channel',
						action: 'Get many conversations',
					},
				],
				default: 'getAll',
			},

			// ------------------------------------------------------- shared paging
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				description: 'Whether to return all results or only up to a given limit',
				displayOptions: { show: { operation: ['getAll'] } },
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 50,
				typeOptions: { minValue: 1 },
				description: 'Max number of results to return',
				displayOptions: { show: { operation: ['getAll'], returnAll: [false] } },
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				let responseData: IDataObject | IDataObject[] = {};

				if (resource === 'contact') {
					if (operation === 'create') {
						const body: IDataObject = { ...(this.getNodeParameter('additionalFields', i) as IDataObject) };
						const name = this.getNodeParameter('name', i) as string;
						if (name) body.name = name;
						if (!body.name && !body.username && !body.phone && !body.email && !body.externalId) {
							throw new NodeOperationError(
								this.getNode(),
								'Fill in at least one of name, username, phone, email or external ID',
								{ itemIndex: i },
							);
						}
						responseData = await crmSolidRequest.call(this, 'POST', '/v1/contacts', body);
					} else if (operation === 'get') {
						const id = this.getNodeParameter('contactId', i) as number;
						responseData = await crmSolidRequest.call(this, 'GET', `/v1/contacts/${id}`);
					} else if (operation === 'update') {
						const id = this.getNodeParameter('contactId', i) as number;
						const body = this.getNodeParameter('additionalFields', i) as IDataObject;
						responseData = await crmSolidRequest.call(this, 'PATCH', `/v1/contacts/${id}`, body);
					} else if (operation === 'delete') {
						const id = this.getNodeParameter('contactId', i) as number;
						await crmSolidRequest.call(this, 'DELETE', `/v1/contacts/${id}`);
						responseData = { success: true, id };
					} else if (operation === 'getAll') {
						responseData = await paginate.call(
							this,
							i,
							'/v1/contacts',
							this.getNodeParameter('filters', i) as IDataObject,
						);
					}
				} else if (resource === 'deal') {
					if (operation === 'create') {
						const body: IDataObject = {
							title: this.getNodeParameter('title', i) as string,
							...(this.getNodeParameter('dealFields', i) as IDataObject),
						};
						responseData = await crmSolidRequest.call(this, 'POST', '/v1/deals', body);
					} else if (operation === 'getAll') {
						responseData = await paginate.call(
							this,
							i,
							'/v1/deals',
							this.getNodeParameter('dealFilters', i) as IDataObject,
						);
					}
				} else if (resource === 'conversation') {
					// Conversations key their cursor on last-activity time, not on an id.
					responseData = await paginate.call(this, i, '/v1/conversations', {}, 'before');
				}

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(responseData),
					{ itemData: { item: i } },
				);
				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
