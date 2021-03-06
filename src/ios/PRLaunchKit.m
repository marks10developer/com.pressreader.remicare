//
//  PRLaunchKit.m
//  PRLaunchKit
//
//  Created by Vitali Bounine on 2015-03-10.
//  Copyright (c) 2015 NewspaperDirect. All rights reserved.
//

#import "PRLaunchKit.h"
#import <Cordova/CDV.h>
#import <CommonCrypto/CommonCrypto.h>
#import <CommonCrypto/CommonHMAC.h>

@implementation PRLaunchKit

- (void)launchPressReader:(CDVInvokedUrlCommand*)command
{
    NSDictionary * args = nil;
    NSInteger siteID = [[command argumentAtIndex:1 withDefault:nil] intValue];
    NSString *secret = [command argumentAtIndex:2 withDefault:nil];
    NSString *giftID = [command argumentAtIndex:3 withDefault:nil];
    NSInteger duration = 24;
    NSString *token = [self giftedJwtWithId:giftID siteID:siteID duration:duration tokenExpiration:24 signingSecret:secret];
    args = @{@"jwt": token};
    [PRAppLaunchKit defaultAppLaunch].subscriptionKey = [command argumentAtIndex:0 withDefault:nil];
    [[PRAppLaunchKit defaultAppLaunch] launchAppWithCommand:@"register-gifted-access" URLParameters:args];
    
    NSLog(@"Token Value %@", token);
    NSLog(@"subscription key %@", [command argumentAtIndex:0 withDefault:nil]);
    NSLog(@"site ID  %d", [[command argumentAtIndex:1 withDefault:nil] intValue]);
    NSLog(@"gift ID %@", giftID);
    NSLog(@"secret ID %@", secret);

}


- (NSData *)HS256SignPayload:(NSString *)theString withSecret:(NSString *)theSecret;
{
    const char *cString = [theString cStringUsingEncoding:NSUTF8StringEncoding];
    const char *cSecret = [theSecret cStringUsingEncoding:NSUTF8StringEncoding];

    unsigned char cHMAC[CC_SHA256_DIGEST_LENGTH];
    CCHmac(kCCHmacAlgSHA256, cSecret, strlen(cSecret), cString, strlen(cString), cHMAC);
    return [NSData dataWithBytes:cHMAC length:sizeof(cHMAC)];
}

- (NSString *)giftedJwtWithId:(NSString *)issID siteID:(NSInteger)siteid duration:(NSInteger)accessH tokenExpiration:(NSInteger)tokenH signingSecret:(NSString *)secret
{
    NSString * header = @"{\"alg\": \"HS256\",\"typ\": \"JWT\"}";
    long now = lround([[NSDate date] timeIntervalSince1970]);
    NSDictionary * payload = @{@"iss":@"Qantas", @"jti":issID, @"iat":@(now), @"nbf":@(now-3600), @"exp":@(now + 3600 * tokenH), @"site-id":@(siteid), @"gift-period": @{@"num-hours":@(accessH)}};
    NSString *b64Header = [[[header dataUsingEncoding:NSUTF8StringEncoding] base64EncodedStringWithOptions:0] stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"="]];
    NSString *b64payload = [[[NSJSONSerialization dataWithJSONObject:payload options:0 error:NULL] base64EncodedStringWithOptions:0] stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"="]];
    NSString *signingInput = [@[b64Header, b64payload] componentsJoinedByString:@"."];
    NSString *signingOutput = [[[self HS256SignPayload:signingInput withSecret:secret] base64EncodedStringWithOptions:0] stringByTrimmingCharactersInSet:[NSCharacterSet characterSetWithCharactersInString:@"="]];

    return [@[signingInput, signingOutput] componentsJoinedByString:@"."];
}

@end