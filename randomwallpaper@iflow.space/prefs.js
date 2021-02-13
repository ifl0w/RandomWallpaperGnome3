const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const ExtensionUtils = imports.misc.extensionUtils;

const Self = ExtensionUtils.getCurrentExtension();
const Convenience = Self.imports.convenience;

const WallpaperController = Self.imports.wallpaperController;

const RWG_SETTINGS_SCHEMA = 'org.gnome.shell.extensions.space.iflow.randomwallpaper';
const RWG_SETTINGS_SCHEMA_UNSPLASH = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.unsplash';
const RWG_SETTINGS_SCHEMA_WALLHAVEN = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.wallhaven';
const RWG_SETTINGS_SCHEMA_REDDIT = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.reddit';
const RWG_SETTINGS_SCHEMA_GENERIC_JSON = 'org.gnome.shell.extensions.space.iflow.randomwallpaper.genericJSON';

const LoggerModule = Self.imports.logger;

function init(metaData) {
	//Convenience.initTranslations();
}

function buildPrefsWidget() {
	let settings = new RandomWallpaperSettings();
	let widget = settings.widget;
	widget.show_all();

	return widget;
}

/* UI Setup */
var RandomWallpaperSettings = class {

	constructor() {
		this.logger = new LoggerModule.Logger('RWG3', 'RandomWallpaper.Settings');

		this.currentSourceSettingsWidget = null;

		this._wallpaperController = null;

		this._settings = Convenience.getSettings(RWG_SETTINGS_SCHEMA);
		this._builder = new Gtk.Builder();
		//this._builder.set_translation_domain(Self.metadata['gettext-domain']);
		this._builder.add_from_file(Self.path + '/settings.ui');

		this.noSettings = this._builder.get_object('no-settings');

		// Unsplash Settings
		this._unsplash_settings = Convenience.getSettings(RWG_SETTINGS_SCHEMA_UNSPLASH);
		this.unsplashSettings = this._builder.get_object('unsplash-settings');
		this.bindUnsplash();

		// Wallhaven Settings
		this._wallhaven_settings = Convenience.getSettings(RWG_SETTINGS_SCHEMA_WALLHAVEN);
		this.wallhavenSettings = this._builder.get_object('wallhaven-settings');
		this.bindWallhaven();

		// Reddit Settings
		this._reddit_settings = Convenience.getSettings(RWG_SETTINGS_SCHEMA_REDDIT);
		this.redditSettings = this._builder.get_object('reddit-settings');
		this.bindReddit();

		// Generic JSON Settings
		this._generic_json_settings = Convenience.getSettings(RWG_SETTINGS_SCHEMA_GENERIC_JSON);
		this.genericJsonSettings = this._builder.get_object('generic-json-settings');
		this.bindGenericJSON();

		this._toggleAfSliders();

		this.widget = this._builder.get_object('main-widget');

		this._builder.get_object('af-switch').connect('notify::active', function (toggleSwitch) {
			this._toggleAfSliders();
		}.bind(this));

		this._builder.get_object('source-combo').connect('changed', (sourceCombo) => {
			let container = this._builder.get_object('source-settings-container');
			if (this.currentSourceSettingsWidget !== null) {
				container.remove(this.currentSourceSettingsWidget);
			}

			switch (sourceCombo.active) {
				case 0: // unsplash
					this.currentSourceSettingsWidget = this.unsplashSettings;
					break;
				case 1: // wallhaven
					this.currentSourceSettingsWidget = this.wallhavenSettings;
					break;
				case 2: // reddit
					this.currentSourceSettingsWidget = this.redditSettings;
					break;
				case 3: // generic JSON
					this.currentSourceSettingsWidget = this.genericJsonSettings;
					break;
				default:
					this.currentSourceSettingsWidget = this.noSettings;
					break;
			}

			container.add(this.currentSourceSettingsWidget);
		});

		this._settings.bind('history-length',
			this._builder.get_object('history-length'),
			'value',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('minutes',
			this._builder.get_object('duration-minutes'),
			'value',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('hours',
			this._builder.get_object('duration-hours'),
			'value',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('source',
			this._builder.get_object('source-combo'),
			'active-id',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('auto-fetch',
			this._builder.get_object('af-switch'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('change-lock-screen',
			this._builder.get_object('change-lock-screen'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._settings.bind('disable-hover-preview',
			this._builder.get_object('disable-hover-preview'),
			'active',
			Gio.SettingsBindFlags.DEFAULT)
		this._settings.bind('hide-panel-icon',
			this._builder.get_object('hide-panel-icon'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);

		this._wallpaperController = new WallpaperController.WallpaperController();
		this._bindButtons();
	}

	_toggleAfSliders() {
		if (this._builder.get_object('af-switch').active) {
			this._builder.get_object('duration-slider-hours').set_sensitive(true);
			this._builder.get_object('duration-slider-minutes').set_sensitive(true);
		} else {
			this._builder.get_object('duration-slider-hours').set_sensitive(false);
			this._builder.get_object('duration-slider-minutes').set_sensitive(false);
		}
	}

	bindUnsplash() {
		this._unsplash_settings.bind('unsplash-keyword',
			this._builder.get_object('unsplash-keyword'),
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._unsplash_settings.bind('unsplash-username',
			this._builder.get_object('unsplash-username'),
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._unsplash_settings.bind('unsplash-collections',
			this._builder.get_object('unsplash-collections'),
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._unsplash_settings.bind('image-width',
			this._builder.get_object('unsplash-image-width'),
			'value',
			Gio.SettingsBindFlags.DEFAULT);
		this._unsplash_settings.bind('image-height',
			this._builder.get_object('unsplash-image-height'),
			'value',
			Gio.SettingsBindFlags.DEFAULT);
		this._unsplash_settings.bind('featured-only',
			this._builder.get_object('unsplash-featured-only'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);
	}

	bindWallhaven() {
		this._wallhaven_settings.bind('wallhaven-keyword',
			this._builder.get_object('wallhaven-keyword'),
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._wallhaven_settings.bind('resolutions',
			this._builder.get_object('wallhaven-resolutions'),
			'text',
			Gio.SettingsBindFlags.DEFAULT);

		this._wallhaven_settings.bind('category-general',
			this._builder.get_object('wallhaven-category-general'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._wallhaven_settings.bind('category-anime',
			this._builder.get_object('wallhaven-category-anime'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._wallhaven_settings.bind('category-people',
			this._builder.get_object('wallhaven-category-people'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);

		this._wallhaven_settings.bind('allow-sfw',
			this._builder.get_object('wallhaven-allow-sfw'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);
		this._wallhaven_settings.bind('allow-sketchy',
			this._builder.get_object('wallhaven-allow-sketchy'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);
	}

	bindReddit() {
		this._reddit_settings.bind('subreddits',
			this._builder.get_object('reddit-subreddits'),
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._reddit_settings.bind('allow-sfw',
			this._builder.get_object('reddit-allow-sfw'),
			'active',
			Gio.SettingsBindFlags.DEFAULT);
	}

	bindGenericJSON() {
		this._generic_json_settings.bind('generic-json-request-url',
			this._builder.get_object('generic-json-request-url'),
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._generic_json_settings.bind('generic-json-response-path',
			this._builder.get_object('generic-json-response-path'),
			'text',
			Gio.SettingsBindFlags.DEFAULT);
		this._generic_json_settings.bind('generic-json-url-prefix',
			this._builder.get_object('generic-json-url-prefix'),
			'text',
			Gio.SettingsBindFlags.DEFAULT);
	}

	_bindButtons() {
		let newWallpaperButton = this._builder.get_object('request-new-wallpaper');
		let origNewWallpaperText = newWallpaperButton.get_label();
		newWallpaperButton.connect('clicked', () => {
			newWallpaperButton.set_label("Loading ...");
			newWallpaperButton.set_sensitive(false);

			this._wallpaperController.update();
			this._wallpaperController.fetchNewWallpaper(() => {
				this._wallpaperController.update();
				newWallpaperButton.set_label(origNewWallpaperText);
				newWallpaperButton.set_sensitive(true);
			});
		});

		this._builder.get_object('clear-history').connect('clicked', () => {
			this._wallpaperController.update();
			this._wallpaperController.deleteHistory();
		});

		this._builder.get_object('open-wallpaper-folder').connect('clicked', () => {
			let uri = GLib.filename_to_uri(this._wallpaperController.wallpaperlocation, "");
			Gio.AppInfo.launch_default_for_uri(uri, Gio.AppLaunchContext.new());
		});
	}

};
