const ByteArray = imports.byteArray;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const SettingsModule = Self.imports.settings;
const HistoryModule = Self.imports.history;
const SoupBowl = Self.imports.soupBowl;

const BaseAdapter = Self.imports.adapter.baseAdapter;

var RedditAdapter = class extends BaseAdapter.BaseAdapter {
	constructor(id, name, wallpaperLocation) {
		super({
			id: id,
			schemaID: SettingsModule.RWG_SETTINGS_SCHEMA_SOURCES_REDDIT,
			schemaPath: `${SettingsModule.RWG_SETTINGS_SCHEMA_PATH}/sources/reddit/${id}/`,
			wallpaperLocation: wallpaperLocation,
			name: name,
			defaultName: 'Reddit'
		});

		this.bowl = new SoupBowl.Bowl();
	}

	_ampDecode(string) {
		return string.replace(/\&amp;/g, '&');
	}

	requestRandomImage(callback) {
		const subreddits = this._settings.get('subreddits', 'string').split(',').map(s => s.trim()).join('+');
		const require_sfw = this._settings.get('allow-sfw', 'boolean');

		const url = encodeURI('https://www.reddit.com/r/' + subreddits + '.json');
		let message = this.bowl.Soup.Message.new('GET', url);
		if (message === null) {
			this._error("Could not create request.", callback);
			return;
		}

		this.bowl.send_and_receive(message, (response_body_bytes) => {
			try {
				const response_body = JSON.parse(ByteArray.toString(response_body_bytes));

				const submissions = response_body.data.children.filter(child => {
					if (child.data.post_hint !== 'image') return false;
					if (require_sfw) return child.data.over_18 === false;

					let minWidth = this._settings.get('min-width', 'int');
					let minHeight = this._settings.get('min-height', 'int');
					if (child.data.preview.images[0].source.width < minWidth) return false;
					if (child.data.preview.images[0].source.height < minHeight) return false;

					let imageRatio1 = this._settings.get('image-ratio1', 'int');
					let imageRatio2 = this._settings.get('image-ratio2', 'int');
					if (child.data.preview.images[0].source.width / imageRatio1 * imageRatio2 < child.data.preview.images[0].source.height) return false;
					return true;
				});
				if (submissions.length === 0) {
					this._error("No suitable submissions found!", callback);
					return;
				}

				let submission;
				let imageDownloadUrl;
				for (let i = 0; i < 5; i++) {
					const random = Math.floor(Math.random() * submissions.length);
					submission = submissions[random].data;
					imageDownloadUrl = this._ampDecode(submission.preview.images[0].source.url);

					if (!this._isImageBlocked(this.fileName(imageDownloadUrl))) {
						break;
					}

					imageDownloadUrl = null;
				}

				if (imageDownloadUrl === null) {
					this._error("Only blocked images found.", callback);
					return;
				}

				if (callback) {
					let historyEntry = new HistoryModule.HistoryEntry(null, this._sourceName, imageDownloadUrl);
					historyEntry.source.sourceUrl = 'https://www.reddit.com/' + submission.subreddit_name_prefixed;
					historyEntry.source.imageLinkUrl = 'https://www.reddit.com/' + submission.permalink;
					callback(historyEntry);
				}
			} catch (e) {
				this._error("Could not create request. (" + e + ")", callback);
			}
		});
	}
};
