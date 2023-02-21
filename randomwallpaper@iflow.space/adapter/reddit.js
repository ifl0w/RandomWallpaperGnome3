const ByteArray = imports.byteArray;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const SettingsModule = Self.imports.settings;
const HistoryModule = Self.imports.history;
const SoupBowl = Self.imports.soupBowl;

const BaseAdapter = Self.imports.adapter.baseAdapter;

const RWG_SETTINGS_SCHEMA_REDDIT = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.sources.reddit';

var RedditAdapter = class extends BaseAdapter.BaseAdapter {
	constructor(id, wallpaperLocation) {
		super(wallpaperLocation);

		let path = `/org/gnome/shell/extensions/space-iflow-randomwallpaper/sources/reddit/${id}/`;
		this._settings = new SettingsModule.Settings(RWG_SETTINGS_SCHEMA_REDDIT, path);
		this.bowl = new SoupBowl.Bowl();
	}

	_ampDecode(string) {
		return string.replace(/\&amp;/g, '&');
	}

	requestRandomImage(callback) {
		const subreddits = this._settings.get('subreddits', 'string').split(',').map(s => s.trim()).join('+');
		const require_sfw = this._settings.get('allow-sfw', 'boolean');
		let identifier = this._settings.get("name", "string");
		if (identifier === null || identifier === "") {
			identifier = 'Reddit';
		}

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
					return true;
				});
				if (submissions.length === 0) {
					this._error("No suitable submissions found!", callback);
					return;
				}
				const random = Math.floor(Math.random() * submissions.length);
				const submission = submissions[random].data;
				const imageDownloadUrl = this._ampDecode(submission.preview.images[0].source.url);

				if (callback) {
					let historyEntry = new HistoryModule.HistoryEntry(null, identifier, imageDownloadUrl);
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
