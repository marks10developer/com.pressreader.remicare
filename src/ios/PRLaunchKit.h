//
//  PRLaunchKit.h
//  PRLaunchKit
//
//  Created by Vitali Bounine on 2015-03-10.
//  Copyright (c) 2015 NewspaperDirect. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <Cordova/CDVPlugin.h>

@interface PRLaunchKit : CDVPlugin

@property (nonatomic, copy) NSString * subscriptionKey; // key used to access https://developers.pressreader.com

@property (nonatomic, copy) NSString * scheme; // default 'PressReader'
@property (nonatomic, copy) NSString * hostName; // default 'PressDisplay.com'
@property (nonatomic, copy) NSString * appStoreID; // default '313904711'

- (void)launchPR:(CDVInvokedUrlCommand*)command;

+ (instancetype) defaultAppLaunch;

- (instancetype) initWithScheme:(NSString *)scheme hostName:(NSString *)hostName appStoreID:(NSString *)appStoreID;
- (instancetype) initWithScheme:(NSString *)scheme;

- (BOOL) isAppInstalled;
- (void) launchAppWithCommand:(NSString *)command URLParameters:(NSDictionary *)urlParameters;
- (void) launchAppWithURLParameters:(NSDictionary *)urlParameters;
- (void) installApp;

@end




